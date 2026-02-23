/**
 * WebSocket real-time layer using Socket.io
 * Provides live strategy execution updates, notifications, and kill-switch.
 */

import { Server as HttpServer } from 'node:http';
import { Server as SocketServer, type Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type { JwtPayload } from '../api/middleware/auth.js';

let io: SocketServer | null = null;

// ─── Socket Events ───────────────────────────────────────────

export const WS_EVENTS = {
    // Server → Client
    EXECUTION_STARTED: 'execution:started',
    EXECUTION_NODE_UPDATE: 'execution:node-update',
    EXECUTION_COMPLETED: 'execution:completed',
    NOTIFICATION: 'notification',
    STRATEGY_STATUS_CHANGE: 'strategy:status-change',
    HEARTBEAT_TICK: 'heartbeat:tick',
    // Client → Server
    SUBSCRIBE_STRATEGY: 'subscribe:strategy',
    UNSUBSCRIBE_STRATEGY: 'unsubscribe:strategy',
    EMERGENCY_KILL: 'emergency:kill',
} as const;

// ─── Setup ───────────────────────────────────────────────────

export function setupWebSocket(httpServer: HttpServer): SocketServer {
    io = new SocketServer(httpServer, {
        cors: {
            origin: env.FRONTEND_URL,
            credentials: true,
        },
        pingTimeout: 20000,
        pingInterval: 25000,
    });

    // JWT Authentication middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
        if (!token) {
            return next(new Error('Authentication required'));
        }
        try {
            const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
            (socket as any).userId = payload.userId;
            (socket as any).email = payload.email;
            next();
        } catch {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket: Socket) => {
        const userId = (socket as any).userId as string;
        logger.info({ userId, socketId: socket.id }, 'WebSocket connected');

        // Auto-join user's personal room
        socket.join(`user:${userId}`);

        // Subscribe to strategy updates
        socket.on(WS_EVENTS.SUBSCRIBE_STRATEGY, (strategyId: string) => {
            socket.join(`strategy:${strategyId}`);
            logger.debug({ userId, strategyId }, 'Subscribed to strategy');
        });

        socket.on(WS_EVENTS.UNSUBSCRIBE_STRATEGY, (strategyId: string) => {
            socket.leave(`strategy:${strategyId}`);
        });

        socket.on('disconnect', (reason) => {
            logger.info({ userId, socketId: socket.id, reason }, 'WebSocket disconnected');
        });
    });

    logger.info('WebSocket server initialized');
    return io;
}

// ─── Emit Helpers ────────────────────────────────────────────

export function getIO(): SocketServer | null {
    return io;
}

export function emitToUser(userId: string, event: string, data: any): void {
    io?.to(`user:${userId}`).emit(event, data);
}

export function emitToStrategy(strategyId: string, event: string, data: any): void {
    io?.to(`strategy:${strategyId}`).emit(event, data);
}

export function emitExecutionStarted(userId: string, strategyId: string, executionRunId: string): void {
    const payload = { executionRunId, strategyId, startedAt: new Date().toISOString() };
    emitToUser(userId, WS_EVENTS.EXECUTION_STARTED, payload);
    emitToStrategy(strategyId, WS_EVENTS.EXECUTION_STARTED, payload);
}

export function emitNodeUpdate(
    _userId: string,
    strategyId: string,
    nodeLog: { nodeId: string; status: string; outputData: any; durationMs: number }
): void {
    emitToStrategy(strategyId, WS_EVENTS.EXECUTION_NODE_UPDATE, nodeLog);
}

export function emitExecutionCompleted(
    userId: string,
    strategyId: string,
    summary: { executionRunId: string; status: string; durationMs: number; orderIntents: number }
): void {
    emitToUser(userId, WS_EVENTS.EXECUTION_COMPLETED, summary);
    emitToStrategy(strategyId, WS_EVENTS.EXECUTION_COMPLETED, summary);
}

export function emitNotification(
    userId: string,
    notification: { id: string; type: string; title: string; body: string }
): void {
    emitToUser(userId, WS_EVENTS.NOTIFICATION, notification);
}
