import twilio from 'twilio';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

let twilioClient: twilio.Twilio | null = null;
if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
    twilioClient = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
}

export interface SmsOptions {
    to: string;
    from?: string; // override default sender
}

export const sendSmsMessage = async (message: string, options: SmsOptions): Promise<boolean> => {
    if (!twilioClient) {
        logger.warn('Twilio credentials not configured. Skipping SMS dispatch.');
        return false;
    }

    try {
        await twilioClient.messages.create({
            body: message,
            to: options.to,
            from: options.from ?? env.TWILIO_PHONE_NUMBER,
        });
        return true;
    } catch (error) {
        logger.error({ error, to: options.to }, 'Failed to send SMS message');
        throw error;
    }
};
