import { Worker, Job } from 'bullmq';
import { getRedis } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { prisma } from '../config/database.js';
import { AgentService, type AgentRunJobData } from '../services/agentService.js';

// ─── Agent Run Worker ─────────────────────────────────────────
// Processes agent run jobs dispatched by the AgentService.
// For scheduled runs (runId is empty), it creates the AgentRun
// record first. For manual runs, it uses the existing record.

export const agentRunWorker = new Worker<AgentRunJobData>(
    'agent-runs',
    async (job: Job<AgentRunJobData>) => {
        const { runId, agentType, userId, context, model } = job.data;
        const logCtx = { jobId: job.id, agentType, userId };

        logger.info(logCtx, 'Processing agent run job');

        let actualRunId = runId;

        // For scheduled jobs, create a new AgentRun record
        if (!runId) {
            const run = await prisma.agentRun.create({
                data: {
                    userId,
                    agentType,
                    triggerType: 'scheduled',
                    status: 'pending',
                    input: context as any,
                },
            });
            actualRunId = run.id;
            logger.debug({ ...logCtx, runId: actualRunId }, 'Created AgentRun for scheduled job');
        }

        // Execute the agent
        const output = await AgentService.executeRun({
            runId: actualRunId,
            agentType,
            userId,
            context,
            model,
        });

        if (output) {
            logger.info(
                {
                    ...logCtx,
                    runId: actualRunId,
                    findings: output.findings?.length ?? 0,
                    recommendations: output.recommendations?.length ?? 0,
                    confidence: output.overall_confidence,
                    tokens: output.tokens_used,
                },
                'Agent run completed'
            );
        } else {
            logger.warn({ ...logCtx, runId: actualRunId }, 'Agent run completed with no output');
        }

        return { runId: actualRunId, success: !!output };
    },
    {
        connection: getRedis() as any,
        concurrency: 2, // Max 2 agent runs in parallel
    }
);

agentRunWorker.on('completed', (job, result) => {
    logger.debug({ jobId: job.id, result }, 'Agent run job completed');
});

agentRunWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, 'Agent run job failed');
});

agentRunWorker.on('error', (err) => {
    logger.error({ error: err.message }, 'Agent run worker error');
});
