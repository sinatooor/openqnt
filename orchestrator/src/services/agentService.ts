/**
 * Agent Service — Orchestrator-side service for running analysis agents.
 *
 * This service:
 * 1. Calls the Python compute service's /compute/agents/run endpoint
 * 2. Logs agent runs in the AgentRun table
 * 3. Creates evidence links between agent findings and data events
 * 4. Manages scheduled agent runs via BullMQ
 */

import { Queue } from 'bullmq';
import type { AgentRunStatus } from '@prisma/client';
import { env } from '../config/env.js';
import { prisma } from '../config/database.js';
import { getRedis } from '../config/redis.js';
import { logger } from '../utils/logger.js';

// ─── Types ────────────────────────────────────────────────────

export interface AgentRunInput {
    agentType: string;
    userId: string;
    triggerType: 'scheduled' | 'manual' | 'event_driven';
    context: Record<string, any>;
    model?: string;
}

export interface AgentFinding {
    title: string;
    description: string;
    signal: string;
    impact: string;
    confidence: number;
    symbols: string[];
    evidence_ids: string[];
    metadata: Record<string, any>;
}

export interface AgentRecommendation {
    action: string;
    symbol: string;
    reasoning: string;
    confidence: number;
    urgency: string;
    time_horizon: string;
}

export interface AgentOutputData {
    agent_type: string;
    run_id?: string;
    findings: AgentFinding[];
    recommendations: AgentRecommendation[];
    summary: string;
    overall_confidence: number;
    overall_signal: string;
    tokens_used: number;
    duration_ms: number;
    error?: string;
}

export interface AgentRunJobData {
    runId: string;
    agentType: string;
    userId: string;
    context: Record<string, any>;
    model?: string;
}

// ─── Compute Service Client ──────────────────────────────────

const COMPUTE_URL = env.COMPUTE_SERVICE_URL;
const AGENT_TIMEOUT = 120_000; // 2 minutes for agent runs

async function callAgentRunner(
    agentType: string,
    context: Record<string, any>,
    model?: string
): Promise<{ success: boolean; output?: AgentOutputData; error?: string }> {
    const url = `${COMPUTE_URL}/compute/agents/run`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AGENT_TIMEOUT);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agent_type: agentType,
                context,
                model: model ?? 'gemini-2.0-flash',
            }),
            signal: controller.signal,
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Agent runner error (${response.status}): ${text}`);
        }

        return (await response.json()) as { success: boolean; output?: AgentOutputData; error?: string };
    } finally {
        clearTimeout(timeout);
    }
}

// ─── Queue Setup ──────────────────────────────────────────────

const QUEUE_NAME = 'agent-runs';
let agentQueue: Queue | null = null;

function getAgentQueue(): Queue {
    if (!agentQueue) {
        agentQueue = new Queue(QUEUE_NAME, {
            connection: getRedis() as any,
            defaultJobOptions: {
                attempts: 2,
                backoff: { type: 'exponential', delay: 10_000 },
                removeOnComplete: { count: 200 },
                removeOnFail: { count: 100 },
            },
        });
    }
    return agentQueue;
}

// ─── Agent Service ────────────────────────────────────────────

export class AgentService {
    /**
     * Trigger an agent run. Creates the AgentRun record and dispatches to the worker.
     */
    static async triggerRun(input: AgentRunInput): Promise<string> {
        const { agentType, userId, triggerType, context, model } = input;

        // Create the run record
        const run = await prisma.agentRun.create({
            data: {
                userId,
                agentType,
                triggerType,
                status: 'pending',
                input: context as any,
            },
        });

        // Dispatch to the worker queue
        const queue = getAgentQueue();
        await queue.add(`agent-${run.id}`, {
            runId: run.id,
            agentType,
            userId,
            context,
            model,
        } satisfies AgentRunJobData);

        logger.info({ runId: run.id, agentType, triggerType }, 'Agent run triggered');
        return run.id;
    }

    /**
     * Execute an agent run synchronously (used by the worker).
     * Updates the AgentRun record with results.
     */
    static async executeRun(jobData: AgentRunJobData): Promise<AgentOutputData | null> {
        const { runId, agentType, context, model } = jobData;

        // Mark as running
        await prisma.agentRun.update({
            where: { id: runId },
            data: { status: 'running', startedAt: new Date() },
        });

        try {
            const result = await callAgentRunner(agentType, context, model);

            if (!result.success || !result.output) {
                // Mark as failed
                await prisma.agentRun.update({
                    where: { id: runId },
                    data: {
                        status: 'failed',
                        error: result.error ?? 'Unknown agent error',
                        completedAt: new Date(),
                    },
                });
                return null;
            }

            const output = result.output;

            // Mark as completed
            await prisma.agentRun.update({
                where: { id: runId },
                data: {
                    status: 'completed',
                    output: output as any,
                    confidence: output.overall_confidence,
                    tokensUsed: output.tokens_used,
                    durationMs: output.duration_ms,
                    completedAt: new Date(),
                },
            });

            // Create evidence links for findings that reference data events
            await this.createEvidenceLinks(runId, output);

            return output;
        } catch (error: any) {
            await prisma.agentRun.update({
                where: { id: runId },
                data: {
                    status: 'failed',
                    error: error.message ?? 'Execution error',
                    completedAt: new Date(),
                },
            });
            throw error;
        }
    }

    /**
     * Create evidence links between an agent run and the data events it analyzed.
     */
    private static async createEvidenceLinks(runId: string, output: AgentOutputData) {
        const evidenceIds = new Set<string>();

        for (const finding of output.findings ?? []) {
            for (const eid of finding.evidence_ids ?? []) {
                evidenceIds.add(eid);
            }
        }

        if (evidenceIds.size === 0) return;

        const links = Array.from(evidenceIds).map(dataEventId => ({
            dataEventId,
            entityType: 'agent_run',
            entityId: runId,
            confidence: output.overall_confidence,
        }));

        await prisma.evidenceLink.createMany({ data: links });
        logger.debug({ runId, linkCount: links.length }, 'Evidence links created');
    }

    /**
     * Schedule a recurring agent run.
     */
    static async scheduleAgent(params: {
        userId: string;
        agentType: string;
        context: Record<string, any>;
        intervalSeconds: number;
        model?: string;
    }) {
        const queue = getAgentQueue();
        const jobKey = `scheduled-${params.userId}-${params.agentType}`;

        // Remove existing schedule
        try { await queue.removeRepeatableByKey(jobKey); } catch { /* ok */ }

        await queue.add(
            jobKey,
            {
                runId: '', // Will be created by the worker
                agentType: params.agentType,
                userId: params.userId,
                context: params.context,
                model: params.model,
            } satisfies AgentRunJobData,
            {
                repeat: { every: params.intervalSeconds * 1000 },
                jobId: jobKey,
            }
        );

        logger.info({
            userId: params.userId,
            agentType: params.agentType,
            intervalSeconds: params.intervalSeconds,
        }, 'Agent scheduled');
    }

    /**
     * Remove a scheduled agent run.
     */
    static async unscheduleAgent(userId: string, agentType: string) {
        const queue = getAgentQueue();
        const jobKey = `scheduled-${userId}-${agentType}`;
        try {
            await queue.removeRepeatableByKey(jobKey);
            logger.info({ userId, agentType }, 'Agent unscheduled');
        } catch { /* ok */ }
    }

    // ─── Query Methods ──────────────────────────────────────────

    static async listRuns(filter: {
        userId: string;
        agentType?: string;
        status?: AgentRunStatus;
        limit?: number;
        offset?: number;
    }) {
        const { userId, agentType, status, limit = 50, offset = 0 } = filter;

        const where: any = { userId };
        if (agentType) where.agentType = agentType;
        if (status) where.status = status;

        const [runs, total] = await Promise.all([
            prisma.agentRun.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            prisma.agentRun.count({ where }),
        ]);

        return { runs, total, limit, offset };
    }

    static async getRun(runId: string) {
        return prisma.agentRun.findUnique({ where: { id: runId } });
    }

    static async getAvailableAgents(): Promise<Array<{ type: string; description: string }>> {
        try {
            const url = `${COMPUTE_URL}/compute/agents/types`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Failed to fetch agent types`);
            const data = (await response.json()) as { agents: Array<{ type: string; description: string }> };
            return data.agents;
        } catch (error) {
            logger.error({ error }, 'Failed to fetch agent types from compute service');
            return [];
        }
    }
}
