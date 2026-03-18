import type { DataSource } from '@prisma/client';
import type { RawEvent } from './index.js';
import { logger } from '../../utils/logger.js';

// ─── Insider Trades Fetcher ───────────────────────────────────
// Fetches insider trading data from public SEC EDGAR RSS feeds
// and/or OpenInsider-style sources. SEC Form 4 filings are public.

interface InsiderSourceConfig {
    symbols?: string[];            // Specific tickers to monitor
    rssFeeds?: string[];           // SEC EDGAR RSS feed URLs
    minTransactionValue?: number;  // Filter: minimum $ value
    limit?: number;
}

/**
 * Fetches insider trading data from SEC EDGAR RSS and web sources.
 */
export async function fetchInsider(source: DataSource): Promise<RawEvent[]> {
    const config = source.config as unknown as InsiderSourceConfig;
    const events: RawEvent[] = [];
    const limit = config.limit ?? 30;

    // ── SEC EDGAR RSS for insider filings ──
    // SEC provides RSS feeds for EDGAR filings
    const edgarFeeds = config.rssFeeds ?? [
        'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&dateb=&owner=include&count=40&search_text=&start=0&output=atom',
    ];

    for (const feedUrl of edgarFeeds) {
        try {
            const Parser = (await import('rss-parser')).default;
            const parser = new Parser({ timeout: 15_000 });
            const feed = await parser.parseURL(feedUrl);

            for (const item of (feed.items ?? []).slice(0, limit)) {
                const title = item.title ?? 'Insider Filing';
                const body = item.contentSnippet ?? item.content ?? '';

                // Try to extract ticker from the title
                const matchedSymbol = extractSymbolFromEdgar(title, config.symbols);

                events.push({
                    headline: title,
                    body: body.slice(0, 5000),
                    url: item.link ?? undefined,
                    symbol: matchedSymbol,
                    publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
                    metadata: {
                        source: 'sec_edgar',
                        filingType: 'Form 4',
                        feedUrl,
                    },
                });
            }
        } catch (error) {
            logger.error({ error, feedUrl, sourceId: source.id }, 'Failed to fetch SEC EDGAR RSS');
        }
    }

    // ── OpenInsider-style web scraping (fallback) ──
    if (config.symbols?.length) {
        for (const symbol of config.symbols) {
            try {
                const insiderData = await fetchOpenInsiderData(symbol, limit);
                for (const trade of insiderData) {
                    // Filter by minimum transaction value
                    if (config.minTransactionValue && trade.value < config.minTransactionValue) {
                        continue;
                    }

                    events.push({
                        headline: `${trade.insiderName} ${trade.transactionType} ${trade.shares} shares of ${symbol} ($${trade.value.toLocaleString()})`,
                        body: `Insider: ${trade.insiderName} (${trade.insiderTitle})\nTransaction: ${trade.transactionType}\nShares: ${trade.shares}\nPrice: $${trade.price}\nValue: $${trade.value.toLocaleString()}\nDate: ${trade.filingDate}`,
                        url: trade.filingUrl,
                        symbol: symbol.toUpperCase(),
                        publishedAt: new Date(trade.filingDate),
                        metadata: {
                            source: 'insider_trade',
                            insiderName: trade.insiderName,
                            insiderTitle: trade.insiderTitle,
                            transactionType: trade.transactionType,
                            shares: trade.shares,
                            price: trade.price,
                            value: trade.value,
                        },
                    });
                }
            } catch (error) {
                logger.error({ error, symbol, sourceId: source.id }, 'Failed to fetch insider data');
            }
        }
    }

    return events;
}

// ─── OpenInsider Data Fetcher ─────────────────────────────────

interface InsiderTrade {
    filingDate: string;
    insiderName: string;
    insiderTitle: string;
    transactionType: string; // 'Purchase' | 'Sale'
    shares: number;
    price: number;
    value: number;
    filingUrl?: string;
}

async function fetchOpenInsiderData(symbol: string, limit: number): Promise<InsiderTrade[]> {
    try {
        // Use the SEC EDGAR full-text search API for Form 4 filings
        const url = `https://efts.sec.gov/LATEST/search-index?q=%22${symbol}%22&dateRange=custom&startdt=${getDateNDaysAgo(90)}&enddt=${getTodayDate()}&forms=4&from=0&size=${limit}`;
        const response = await fetch(url, {
            headers: { 'User-Agent': 'OpenQwnt research@openqwnt.com' },
        });

        if (!response.ok) {
            logger.warn({ symbol, status: response.status }, 'SEC EDGAR search failed');
            return [];
        }

        const data = await response.json() as any;
        const hits = data?.hits?.hits ?? [];

        return hits.map((hit: any) => {
            const source = hit._source ?? {};
            return {
                filingDate: source.file_date ?? new Date().toISOString().split('T')[0],
                insiderName: source.display_names?.[0] ?? 'Unknown',
                insiderTitle: '',
                transactionType: 'Filing',
                shares: 0,
                price: 0,
                value: 0,
                filingUrl: source.file_url ? `https://www.sec.gov${source.file_url}` : undefined,
            };
        });
    } catch (error) {
        logger.error({ error, symbol }, 'SEC EDGAR search failed');
        return [];
    }
}

// ─── Helpers ──────────────────────────────────────────────────

function extractSymbolFromEdgar(title: string, watchedSymbols?: string[]): string | undefined {
    if (!watchedSymbols?.length) return undefined;
    const upper = title.toUpperCase();
    for (const sym of watchedSymbols) {
        if (upper.includes(sym.toUpperCase())) return sym.toUpperCase();
    }
    return undefined;
}

function getTodayDate(): string {
    return new Date().toISOString().split('T')[0];
}

function getDateNDaysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
}
