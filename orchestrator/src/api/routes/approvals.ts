/**
 * Approval Routes — HITL (Human-in-the-Loop) approval queue API.
 * 
 * Manages approval requests created when a hitlNode pauses execution.
 * Users can list pending approvals and approve/reject them to resume flows.
 */
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware } from '../middleware/auth.js';
import { prisma } from '../../config/database.js';
import { logger } from '../../utils/logger.js';
import { resumeExecution } from '../../services/executionService.js';
import { Prisma } from '@prisma/client';

const router = Router();
function isDbUnavailable(error: unknown): boolean {
    if (error instanceof Prisma.PrismaClientInitializationError) return true;
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return ['P1001', 'P1002', 'P2021'].includes(error.code);
    }
    const message = (error as { message?: string } | null)?.message;
    if (!message) return false;
    return /connect|ECONNREFUSED|does not exist|no such table/i.test(message);
}


router.use(authMiddleware);

// ── Schemas ─────────────────────────────────────────────────

const resolveSchema = z.object({
    notes: z.string().optional(),
});

// ── Routes ──────────────────────────────────────────────────

/** GET /api/approvals/pending — list pending approval requests */
router.get('/pending', async (req: Request, res: Response) => {
    try {
        const approvals = await prisma.approvalRequest.findMany({
            where: {
                userId: req.user!.userId,
                status: 'pending',
            },
            include: {
                executionRun: {
                    select: {
                        id: true,
                        strategyId: true,
                        triggerType: true,
                        startedAt: true,
                        strategy: {
                            select: { name: true },
                        },
                    },
                },
            },
            orderBy: { requestedAt: 'desc' },
        });

        // Check for expired approvals and mark them
        const now = new Date();
        const active: typeof approvals = [];
        for (const approval of approvals) {
            const expiresAt = new Date(
                approval.requestedAt.getTime() + approval.timeoutMinutes * 60 * 1000
            );
            if (now > expiresAt) {
                // Mark as expired
                await prisma.approvalRequest.update({
                    where: { id: approval.id },
                    data: { status: 'expired', resolvedAt: now },
                });
                // Also mark the execution as cancelled
                await prisma.executionRun.update({
                    where: { id: approval.executionRunId },
                    data: { status: 'cancelled', finishedAt: now },
                });
            } else {
                active.push(approval);
            }
        }

        res.json({
            approvals: active,
            count: active.length,
        });
    } catch (error) {
        if (isDbUnavailable(error)) {
            res.json({ approvals: [], count: 0, warning: 'approvals unavailable' });
            return;
        }
        logger.error({ error }, 'Failed to list pending approvals');
        res.status(500).json({ error: 'Failed to list pending approvals' });
    }
});

/** GET /api/approvals — list all approval requests (with pagination) */
router.get('/', async (req: Request, res: Response) => {
    try {
        const limit = Math.min(Number(req.query.limit) || 50, 200);
        const offset = Number(req.query.offset) || 0;

        const [approvals, total] = await Promise.all([
            prisma.approvalRequest.findMany({
                where: { userId: req.user!.userId },
                include: {
                    executionRun: {
                        select: {
                            id: true,
                            strategyId: true,
                            triggerType: true,
                            strategy: { select: { name: true } },
                        },
                    },
                },
                orderBy: { requestedAt: 'desc' },
                take: limit,
                skip: offset,
            }),
            prisma.approvalRequest.count({
                where: { userId: req.user!.userId },
            }),
        ]);

        res.json({ approvals, total, limit, offset });
    } catch (error) {
        if (isDbUnavailable(error)) {
            const limit = Math.min(Number(req.query.limit) || 50, 200);
            const offset = Number(req.query.offset) || 0;
            res.json({ approvals: [], total: 0, limit, offset, warning: 'approvals unavailable' });
            return;
        }
        logger.error({ error }, 'Failed to list approvals');
        res.status(500).json({ error: 'Failed to list approvals' });
    }
});

/** POST /api/approvals/:id/approve — approve and resume execution */
router.post('/:id/approve', async (req: Request, res: Response) => {
    try {
        const { notes } = resolveSchema.parse(req.body);

        const approval = await prisma.approvalRequest.findUnique({
            where: { id: req.params.id },
        });

        if (!approval || approval.userId !== req.user!.userId) {
            res.status(404).json({ error: 'Approval request not found' });
            return;
        }

        if (approval.status !== 'pending') {
            res.status(400).json({ error: `Cannot approve — status is already ${approval.status}` });
            return;
        }

        // Check expiration
        const expiresAt = new Date(
            approval.requestedAt.getTime() + approval.timeoutMinutes * 60 * 1000
        );
        if (new Date() > expiresAt) {
            await prisma.approvalRequest.update({
                where: { id: approval.id },
                data: { status: 'expired', resolvedAt: new Date() },
            });
            res.status(400).json({ error: 'Approval request has expired' });
            return;
        }

        // Mark as approved
        await prisma.approvalRequest.update({
            where: { id: approval.id },
            data: {
                status: 'approved',
                resolvedAt: new Date(),
                resolvedBy: req.user!.userId,
                notes,
            },
        });

        // Resume the paused execution from the HITL node
        // This loads saved state from Redis and continues evaluating downstream nodes.
        try {
            await resumeExecution(approval.executionRunId);
        } catch (resumeErr) {
            logger.error({
                approvalId: approval.id,
                executionRunId: approval.executionRunId,
                error: resumeErr,
            }, 'Failed to resume execution after approval');

            // Mark execution as error if resume fails
            await prisma.executionRun.update({
                where: { id: approval.executionRunId },
                data: { status: 'error', finishedAt: new Date() },
            });
        }

        logger.info({
            approvalId: approval.id,
            executionRunId: approval.executionRunId,
            userId: req.user!.userId,
        }, 'Approval request approved');

        res.json({
            message: 'Approved',
            approvalId: approval.id,
            executionRunId: approval.executionRunId,
        });
    } catch (error: any) {
        if (error.name === 'ZodError') {
            res.status(400).json({ error: 'Validation error', details: error.errors });
            return;
        }
        logger.error({ error }, 'Failed to approve request');
        res.status(500).json({ error: 'Failed to approve request' });
    }
});

/** POST /api/approvals/:id/reject — reject and cancel execution */
router.post('/:id/reject', async (req: Request, res: Response) => {
    try {
        const { notes } = resolveSchema.parse(req.body);

        const approval = await prisma.approvalRequest.findUnique({
            where: { id: req.params.id },
        });

        if (!approval || approval.userId !== req.user!.userId) {
            res.status(404).json({ error: 'Approval request not found' });
            return;
        }

        if (approval.status !== 'pending') {
            res.status(400).json({ error: `Cannot reject — status is already ${approval.status}` });
            return;
        }

        // Mark as rejected
        await prisma.approvalRequest.update({
            where: { id: approval.id },
            data: {
                status: 'rejected',
                resolvedAt: new Date(),
                resolvedBy: req.user!.userId,
                notes,
            },
        });

        // Cancel the execution
        await prisma.executionRun.update({
            where: { id: approval.executionRunId },
            data: { status: 'cancelled', finishedAt: new Date() },
        });

        logger.info({
            approvalId: approval.id,
            executionRunId: approval.executionRunId,
            userId: req.user!.userId,
        }, 'Approval request rejected');

        res.json({
            message: 'Rejected',
            approvalId: approval.id,
            executionRunId: approval.executionRunId,
        });
    } catch (error: any) {
        if (error.name === 'ZodError') {
            res.status(400).json({ error: 'Validation error', details: error.errors });
            return;
        }
        logger.error({ error }, 'Failed to reject request');
        res.status(500).json({ error: 'Failed to reject request' });
    }
});

export default router;
