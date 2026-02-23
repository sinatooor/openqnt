import TelegramBot from 'node-telegram-bot-api';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';

let bot: TelegramBot | null = null;
if (env.TELEGRAM_BOT_TOKEN) {
    bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN, { polling: false });
}

export interface TelegramOptions {
    chatId: string;
    parseMode?: 'MarkdownV2' | 'HTML';
    replyMarkup?: TelegramBot.InlineKeyboardMarkup;
}

export const sendTelegramMessage = async (message: string, options: TelegramOptions): Promise<boolean> => {
    if (!bot) {
        logger.warn('Telegram bot token not configured. Skipping dispatch.');
        return false;
    }

    try {
        await bot.sendMessage(options.chatId, message, {
            parse_mode: options.parseMode ?? 'MarkdownV2',
            reply_markup: options.replyMarkup,
        });
        return true;
    } catch (error) {
        logger.error({ error, chatId: options.chatId }, 'Failed to send Telegram message');
        throw error;
    }
};
