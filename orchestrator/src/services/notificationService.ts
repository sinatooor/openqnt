import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { NotificationChannel, NotificationType } from '@prisma/client';
import { sendTelegramMessage, TelegramOptions } from './channels/telegram.js';
import { sendSlackMessage, SlackOptions } from './channels/slack.js';
import { sendSmsMessage, SmsOptions } from './channels/sms.js';
import { sendEmailMessage, EmailOptions } from './channels/email.js';
import { Queue } from 'bullmq';
import { getRedis } from '../config/redis.js';

export const notificationQueue = new Queue('notifications', {
    connection: getRedis() as any,
});

export interface DispatchOptions {
    userId: string;
    channel: NotificationChannel;
    type: NotificationType;
    title: string;
    body: string;
    executionRunId?: string;
    metadata?: Record<string, any>;

    // Channel-specific options (populated from user preferences or passed directly)
    telegram?: TelegramOptions;
    slack?: SlackOptions;
    sms?: SmsOptions;
    email?: EmailOptions;
}

export class NotificationService {
    /**
     * Dispatches a notification via the requested channel and logs it in the database.
     */
    static async dispatch(options: DispatchOptions): Promise<boolean> {
        // 1. Log to database immediately as pending
        const notification = await prisma.notification.create({
            data: {
                userId: options.userId,
                channel: options.channel,
                type: options.type,
                title: options.title,
                body: options.body,
                executionRunId: options.executionRunId,
                metadata: options.metadata,
                deliveryStatus: 'pending',
            }
        });

        let success = false;

        try {
            // 2. Dispatch to the appropriate channel
            switch (options.channel) {
                case 'telegram':
                    if (options.telegram) {
                        success = await sendTelegramMessage(options.body, options.telegram);
                    } else {
                        throw new Error('Missing telegram options for dispatch');
                    }
                    break;

                case 'slack':
                    if (options.slack) {
                        success = await sendSlackMessage(options.body, options.slack);
                    } else {
                        throw new Error('Missing slack options for dispatch');
                    }
                    break;

                case 'sms':
                    if (options.sms) {
                        success = await sendSmsMessage(options.body, options.sms);
                    } else {
                        throw new Error('Missing sms options for dispatch');
                    }
                    break;

                case 'email':
                    if (options.email) {
                        success = await sendEmailMessage(options.body, options.email);
                    } else {
                        throw new Error('Missing email options for dispatch');
                    }
                    break;

                case 'in_app':
                case 'push':
                    // In real-time apps, this pushes to the websocket connection
                    // For now, it's just logged in the DB, so it's a success
                    success = true;
                    break;

                default:
                    throw new Error(`Unsupported channel: ${options.channel}`);
            }

            // 3. Update database status
            await prisma.notification.update({
                where: { id: notification.id },
                data: {
                    deliveryStatus: success ? 'sent' : 'failed',
                    sentAt: success ? new Date() : null,
                }
            });

            return success;
        } catch (error) {
            logger.error({ error, notificationId: notification.id }, 'Notification dispatch failed');

            await prisma.notification.update({
                where: { id: notification.id },
                data: { deliveryStatus: 'failed' }
            });

            return false;
        }
    }
}
