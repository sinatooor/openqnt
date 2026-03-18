import type { DataSource } from '@prisma/client';
import type { RawEvent } from './index.js';
import { logger } from '../../utils/logger.js';

// ─── Macro Data Fetcher ───────────────────────────────────────
// Fetches macroeconomic data from the FRED API (Federal Reserve
// Economic Data) and other public economic sources.
//
// FRED API is free with registration: https://fred.stlouisfed.org/docs/api/

interface MacroSourceConfig {
    fredApiKey?: string;        // FRED API key
    series: string[];           // FRED series IDs, e.g. ['CPIAUCSL', 'GDP', 'UNRATE', 'DFF', 'T10Y2Y']
    rssFeeds?: string[];        // Economic calendar RSS feeds
    limit?: number;             // Observations per series
}

// Well-known FRED series and their human-readable names
const SERIES_NAMES: Record<string, string> = {
    'CPIAUCSL': 'CPI (Consumer Price Index)',
    'GDP': 'Gross Domestic Product',
    'GDPC1': 'Real GDP',
    'UNRATE': 'Unemployment Rate',
    'DFF': 'Federal Funds Rate',
    'T10Y2Y': '10Y-2Y Treasury Spread',
    'T10YIE': '10Y Breakeven Inflation Rate',
    'VIXCLS': 'VIX Volatility Index',
    'PAYEMS': 'Nonfarm Payrolls',
    'UMCSENT': 'Consumer Sentiment',
    'PCE': 'Personal Consumption Expenditures',
    'PCEPI': 'PCE Price Index',
    'FEDFUNDS': 'Federal Funds Effective Rate',
    'DGS10': '10-Year Treasury Yield',
    'DGS2': '2-Year Treasury Yield',
    'DTWEXBGS': 'US Dollar Index (Broad)',
    'HOUST': 'Housing Starts',
    'RSAFS': 'Retail Sales',
    'INDPRO': 'Industrial Production Index',
    'NAPM': 'ISM Manufacturing PMI',
};

interface FREDObservation {
    date: string;
    value: string;
}

interface FREDResponse {
    observations: FREDObservation[];
}

/**
 * Fetches macroeconomic data from FRED API.
 * Config shape: { fredApiKey: string, series: string[], limit?: number }
 */
export async function fetchMacro(source: DataSource): Promise<RawEvent[]> {
    const config = source.config as unknown as MacroSourceConfig;
    const events: RawEvent[] = [];

    // ── FRED API data ──
    if (config.fredApiKey && config.series?.length > 0) {
        const limit = config.limit ?? 5;

        for (const seriesId of config.series) {
            try {
                const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${config.fredApiKey}&file_type=json&sort_order=desc&limit=${limit}`;
                const response = await fetch(url);

                if (!response.ok) {
                    logger.warn({ seriesId, status: response.status }, 'FRED API request failed');
                    continue;
                }

                const data = (await response.json()) as FREDResponse;
                const seriesName = SERIES_NAMES[seriesId] ?? seriesId;

                for (const obs of data.observations) {
                    if (obs.value === '.') continue; // FRED uses '.' for missing data

                    const value = parseFloat(obs.value);
                    events.push({
                        headline: `${seriesName}: ${value}`,
                        body: `${seriesName} (${seriesId}) reported value of ${value} for ${obs.date}`,
                        url: `https://fred.stlouisfed.org/series/${seriesId}`,
                        publishedAt: new Date(obs.date),
                        metadata: {
                            seriesId,
                            seriesName,
                            value,
                            date: obs.date,
                            source: 'FRED',
                        },
                    });
                }
            } catch (error) {
                logger.error({ error, seriesId, sourceId: source.id }, 'Failed to fetch FRED series');
            }
        }
    }

    // ── Economic Calendar RSS Feeds ──
    if (config.rssFeeds?.length) {
        try {
            const Parser = (await import('rss-parser')).default;
            const parser = new Parser({ timeout: 15_000 });

            for (const feedUrl of config.rssFeeds) {
                try {
                    const feed = await parser.parseURL(feedUrl);
                    for (const item of (feed.items ?? []).slice(0, 20)) {
                        events.push({
                            headline: item.title ?? 'Economic Event',
                            body: item.contentSnippet ?? item.content ?? '',
                            url: item.link ?? undefined,
                            publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
                            metadata: {
                                source: 'economic_calendar',
                                feedUrl,
                            },
                        });
                    }
                } catch (error) {
                    logger.error({ error, feedUrl }, 'Failed to parse economic RSS feed');
                }
            }
        } catch {
            logger.warn('rss-parser not available for economic calendar feeds');
        }
    }

    return events;
}
