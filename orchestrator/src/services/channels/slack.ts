import { WebClient } from '@slack/web-api';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

let slackClient: WebClient | null = null;
if (env.SLACK_BOT_TOKEN) {
    slackClient = new WebClient(env.SLACK_BOT_TOKEN);
}

export interface SlackOptions {
    channel: string;
    blocks?: any[];
}

export const sendSlackMessage = async (message: string, options: SlackOptions): Promise<boolean> => {
    if (!slackClient) {
        logger.warn('Slack token not configured. Skipping dispatch.');
        return false;
    }

    try {
        await slackClient.chat.postMessage({
            channel: options.channel,
            text: message,
            blocks: options.blocks,
        });
        return true;
    } catch (error) {
        logger.error({ error, channel: options.channel }, 'Failed to send Slack message');
        throw error;
    }
};
