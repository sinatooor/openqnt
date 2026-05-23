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

export interface TelegramAttachmentOptions extends TelegramOptions {
    caption?: string;
    /** Filename shown in Telegram for documents. Ignored for photos. */
    filename?: string;
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

/**
 * Send a photo (e.g. a Monte Carlo plot PNG) with an optional caption.
 * `source` is anything `node-telegram-bot-api` accepts — an absolute path,
 * a Buffer, or a readable stream.
 */
export const sendTelegramPhoto = async (
    source: string | Buffer | NodeJS.ReadableStream,
    options: TelegramAttachmentOptions,
): Promise<boolean> => {
    if (!bot) {
        logger.warn('Telegram bot token not configured. Skipping photo dispatch.');
        return false;
    }
    try {
        await bot.sendPhoto(options.chatId, source as any, {
            caption: options.caption,
            parse_mode: options.parseMode ?? 'HTML',
            reply_markup: options.replyMarkup,
        });
        return true;
    } catch (error) {
        logger.error({ error, chatId: options.chatId }, 'Failed to send Telegram photo');
        throw error;
    }
};

/**
 * Send a document (PDFs, CSVs, large images). For images Telegram will
 * compress them automatically when sent as a photo; use `sendTelegramDocument`
 * when you want the original file preserved.
 */
export const sendTelegramDocument = async (
    source: string | Buffer | NodeJS.ReadableStream,
    options: TelegramAttachmentOptions,
): Promise<boolean> => {
    if (!bot) {
        logger.warn('Telegram bot token not configured. Skipping document dispatch.');
        return false;
    }
    try {
        const sendOpts: any = {
            caption: options.caption,
            parse_mode: options.parseMode ?? 'HTML',
            reply_markup: options.replyMarkup,
        };
        const fileOpts: any = options.filename ? { filename: options.filename } : undefined;
        await bot.sendDocument(options.chatId, source as any, sendOpts, fileOpts);
        return true;
    } catch (error) {
        logger.error({ error, chatId: options.chatId }, 'Failed to send Telegram document');
        throw error;
    }
};
