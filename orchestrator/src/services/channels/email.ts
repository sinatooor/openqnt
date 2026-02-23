import sgMail from '@sendgrid/mail';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

if (env.SENDGRID_API_KEY) {
    sgMail.setApiKey(env.SENDGRID_API_KEY);
}

export interface EmailOptions {
    to: string;
    subject: string;
    html?: string;
}

export const sendEmailMessage = async (message: string, options: EmailOptions): Promise<boolean> => {
    if (!env.SENDGRID_API_KEY) {
        logger.warn('Sendgrid API key not configured. Skipping email dispatch.');
        return false;
    }

    try {
        await sgMail.send({
            to: options.to,
            from: env.EMAIL_FROM_ADDRESS ?? 'noreply@strategyflow.app',
            subject: options.subject,
            text: message,
            html: options.html ?? `<p>${message}</p>`,
        });
        return true;
    } catch (error) {
        logger.error({ error, to: options.to }, 'Failed to send email message');
        throw error;
    }
};
