import Parser from 'rss-parser';
import type { DataSource } from '@prisma/client';
import type { RawEvent } from './index.js';
import { logger } from '../../utils/logger.js';

// ─── RSS News Fetcher ─────────────────────────────────────────
// Refactored from the original newsService.ts. Conforms to the
// generic FetcherFn interface so it plugs into the data-ingestion
// worker pipeline.

const parser = new Parser({
    headers: {
        Accept: 'application/rss+xml, application/rdf+xml;q=0.8, application/atom+xml;q=0.6, application/xml;q=0.4, text/xml;q=0.4',
    },
    timeout: 15_000,
});

interface NewsSourceConfig {
    urls: string[];
    limit?: number;           // Max articles per feed (default 20)
    symbols?: string[];       // Optional: tag articles if they mention these symbols
}

/**
 * Fetches news articles from configured RSS feed URLs.
 * Config shape: { urls: string[], limit?: number, symbols?: string[] }
 */
export async function fetchNews(source: DataSource): Promise<RawEvent[]> {
    const config = source.config as unknown as NewsSourceConfig;

    if (!config.urls || !Array.isArray(config.urls) || config.urls.length === 0) {
        logger.warn({ sourceId: source.id }, 'News source has no URLs configured');
        return [];
    }

    const limit = config.limit ?? 20;
    const symbolSet = new Set((config.symbols ?? []).map(s => s.toUpperCase()));
    const allEvents: RawEvent[] = [];

    for (const url of config.urls) {
        try {
            const feed = await parser.parseURL(url);
            if (!feed.items) continue;

            for (const item of feed.items.slice(0, limit)) {
                const headline = item.title ?? 'No Title';
                const body = item.contentSnippet ?? item.content ?? '';

                // Simple symbol detection: check if any configured symbols appear in headline or body
                let matchedSymbol: string | undefined;
                if (symbolSet.size > 0) {
                    const text = `${headline} ${body}`.toUpperCase();
                    for (const sym of symbolSet) {
                        if (text.includes(sym) || text.includes(`$${sym}`)) {
                            matchedSymbol = sym;
                            break;
                        }
                    }
                }

                allEvents.push({
                    headline,
                    body: body.slice(0, 5000), // Cap body length
                    url: item.link ?? undefined,
                    symbol: matchedSymbol,
                    publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
                    metadata: {
                        sourceFeed: url,
                        feedTitle: feed.title ?? undefined,
                        categories: item.categories ?? [],
                        creator: item.creator ?? undefined,
                    },
                });
            }
        } catch (error) {
            logger.error({ error, url, sourceId: source.id }, 'Failed to parse RSS feed');
            // Continue with other URLs even if one fails
        }
    }

    return allEvents;
}
