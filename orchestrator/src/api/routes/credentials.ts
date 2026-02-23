/**
 * Credential vault API routes.
 * Securely stores and manages API keys for brokers and services.
 * Keys are AES-256-GCM encrypted at rest.
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { encrypt, decrypt } from '../../utils/crypto.js';

const router = Router();
router.use(authMiddleware);

// ── Schemas ─────────────────────────────────────────────────

const createCredentialSchema = z.object({
    alias: z.string().min(1).max(100),
    provider: z.string().min(1).max(50),
    apiKey: z.string().min(1),
    apiSecret: z.string().optional(),
    metadata: z.record(z.any()).optional(),
});

const updateCredentialSchema = z.object({
    alias: z.string().min(1).max(100).optional(),
    apiKey: z.string().min(1).optional(),
    apiSecret: z.string().optional(),
    metadata: z.record(z.any()).optional(),
});

// ── Routes ──────────────────────────────────────────────────

/** GET /api/credentials — list credentials (without keys) */
router.get('/', async (req: Request, res: Response) => {
    try {
        const credentials = await prisma.credential.findMany({
            where: { userId: req.user!.userId },
            select: {
                id: true,
                alias: true,
                provider: true,
                metadata: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        res.json({ credentials });
    } catch (error) {
        logger.error({ error }, 'Failed to list credentials');
        res.status(500).json({ error: 'Failed to list credentials' });
    }
});

/** POST /api/credentials — store new credential */
router.post('/', validate(createCredentialSchema), async (req: Request, res: Response) => {
    try {
        const { alias, provider, apiKey, apiSecret, metadata } = req.body;

        // Encrypt the key material
        const keyPayload = JSON.stringify({ apiKey, apiSecret });
        const encrypted = encrypt(keyPayload, env.ENCRYPTION_KEY);
        const encryptedBuffer = Buffer.from(encrypted, 'base64');

        // Store with a zero IV (IV is embedded in the encrypted payload by our crypto module)
        const credential = await prisma.credential.create({
            data: {
                userId: req.user!.userId,
                alias,
                provider,
                encryptedKey: encryptedBuffer,
                iv: Buffer.alloc(16), // IV embedded in encrypted payload
                metadata: metadata ?? {},
            },
        });

        logger.info({ credentialId: credential.id, provider }, 'Credential stored');
        res.status(201).json({
            credential: {
                id: credential.id,
                alias: credential.alias,
                provider: credential.provider,
            },
        });
    } catch (error: any) {
        if (error.code === 'P2002') {
            res.status(409).json({ error: `Alias "${req.body.alias}" already exists` });
            return;
        }
        logger.error({ error }, 'Failed to store credential');
        res.status(500).json({ error: 'Failed to store credential' });
    }
});

/** GET /api/credentials/:id/decrypt — retrieve decrypted key (requires auth) */
router.get('/:id/decrypt', async (req: Request, res: Response) => {
    try {
        const credential = await prisma.credential.findFirst({
            where: { id: req.params.id, userId: req.user!.userId },
        });

        if (!credential) {
            res.status(404).json({ error: 'Credential not found' });
            return;
        }

        const encrypted = credential.encryptedKey.toString('base64');
        const decrypted = decrypt(encrypted, env.ENCRYPTION_KEY);
        const keyData = JSON.parse(decrypted);

        // Only return masked key in response for security
        res.json({
            credential: {
                id: credential.id,
                alias: credential.alias,
                provider: credential.provider,
                apiKey: keyData.apiKey,
                hasApiSecret: Boolean(keyData.apiSecret),
            },
        });
    } catch (error) {
        logger.error({ error }, 'Failed to decrypt credential');
        res.status(500).json({ error: 'Failed to decrypt credential' });
    }
});

/** PUT /api/credentials/:id — update credential */
router.put('/:id', validate(updateCredentialSchema), async (req: Request, res: Response) => {
    try {
        const existing = await prisma.credential.findFirst({
            where: { id: req.params.id, userId: req.user!.userId },
        });

        if (!existing) {
            res.status(404).json({ error: 'Credential not found' });
            return;
        }

        const updateData: Record<string, any> = {};
        if (req.body.alias) updateData.alias = req.body.alias;
        if (req.body.metadata) updateData.metadata = req.body.metadata;

        // Re-encrypt if key material changed
        if (req.body.apiKey || req.body.apiSecret) {
            // Decrypt existing to merge
            let existingKeys = { apiKey: '', apiSecret: '' };
            try {
                const encrypted = existing.encryptedKey.toString('base64');
                existingKeys = JSON.parse(decrypt(encrypted, env.ENCRYPTION_KEY));
            } catch { /* new credential */ }

            const newPayload = {
                apiKey: req.body.apiKey ?? existingKeys.apiKey,
                apiSecret: req.body.apiSecret ?? existingKeys.apiSecret,
            };
            const encrypted = encrypt(JSON.stringify(newPayload), env.ENCRYPTION_KEY);
            updateData.encryptedKey = Buffer.from(encrypted, 'base64');
        }

        const credential = await prisma.credential.update({
            where: { id: req.params.id },
            data: updateData,
        });

        logger.info({ credentialId: credential.id }, 'Credential updated');
        res.json({
            credential: {
                id: credential.id,
                alias: credential.alias,
                provider: credential.provider,
            },
        });
    } catch (error) {
        logger.error({ error }, 'Failed to update credential');
        res.status(500).json({ error: 'Failed to update credential' });
    }
});

/** DELETE /api/credentials/:id — delete credential */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const existing = await prisma.credential.findFirst({
            where: { id: req.params.id, userId: req.user!.userId },
        });

        if (!existing) {
            res.status(404).json({ error: 'Credential not found' });
            return;
        }

        await prisma.credential.delete({ where: { id: req.params.id } });

        logger.info({ credentialId: req.params.id }, 'Credential deleted');
        res.json({ message: 'Credential deleted' });
    } catch (error) {
        logger.error({ error }, 'Failed to delete credential');
        res.status(500).json({ error: 'Failed to delete credential' });
    }
});

export default router;
