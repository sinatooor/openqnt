/**
 * WebSocket Hook — Socket.io client for real-time updates.
 * Auto-connects when authenticated, subscribes to strategy/execution events.
 */

import { useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';
import { API_BASE_URL } from '../services/api';

const WS_EVENTS = {
    EXECUTION_STARTED: 'execution:started',
    EXECUTION_NODE_UPDATE: 'execution:node-update',
    EXECUTION_COMPLETED: 'execution:completed',
    NOTIFICATION: 'notification',
    STRATEGY_STATUS_CHANGE: 'strategy:status-change',
    HEARTBEAT_TICK: 'heartbeat:tick',
} as const;

type EventHandler = (data: any) => void;

interface UseWebSocketOptions {
    strategyId?: string;
    onExecutionStarted?: EventHandler;
    onNodeUpdate?: EventHandler;
    onExecutionCompleted?: EventHandler;
    onNotification?: EventHandler;
    onStrategyStatusChange?: EventHandler;
    onHeartbeatTick?: EventHandler;
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
    const socketRef = useRef<Socket | null>(null);
    const { accessToken, isAuthenticated } = useAuthStore();

    useEffect(() => {
        if (!isAuthenticated || !accessToken) return;

        const socket = io(API_BASE_URL, {
            auth: { token: accessToken },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 10,
            reconnectionDelay: 1000,
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            console.log('[WS] Connected:', socket.id);
            // Subscribe to strategy if provided
            if (options.strategyId) {
                socket.emit('subscribe:strategy', options.strategyId);
            }
        });

        // Event handlers
        if (options.onExecutionStarted) {
            socket.on(WS_EVENTS.EXECUTION_STARTED, options.onExecutionStarted);
        }
        if (options.onNodeUpdate) {
            socket.on(WS_EVENTS.EXECUTION_NODE_UPDATE, options.onNodeUpdate);
        }
        if (options.onExecutionCompleted) {
            socket.on(WS_EVENTS.EXECUTION_COMPLETED, options.onExecutionCompleted);
        }
        if (options.onNotification) {
            socket.on(WS_EVENTS.NOTIFICATION, options.onNotification);
        }
        if (options.onStrategyStatusChange) {
            socket.on(WS_EVENTS.STRATEGY_STATUS_CHANGE, options.onStrategyStatusChange);
        }
        if (options.onHeartbeatTick) {
            socket.on(WS_EVENTS.HEARTBEAT_TICK, options.onHeartbeatTick);
        }

        socket.on('disconnect', (reason) => {
            console.log('[WS] Disconnected:', reason);
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [isAuthenticated, accessToken, options.strategyId]);

    const subscribeStrategy = useCallback((strategyId: string) => {
        socketRef.current?.emit('subscribe:strategy', strategyId);
    }, []);

    const unsubscribeStrategy = useCallback((strategyId: string) => {
        socketRef.current?.emit('unsubscribe:strategy', strategyId);
    }, []);

    const emergencyKill = useCallback(() => {
        socketRef.current?.emit('emergency:kill');
    }, []);

    return {
        socket: socketRef.current,
        isConnected: socketRef.current?.connected ?? false,
        subscribeStrategy,
        unsubscribeStrategy,
        emergencyKill,
    };
}
