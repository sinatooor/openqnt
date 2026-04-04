/**
 * Earnings Data Fetcher — Fetches earnings calendar, estimates, and actuals.
 *
 * Uses Financial Modeling Prep (FMP) API for:
 * - Upcoming earnings dates
 * - EPS estimates vs actuals (surprises)
 * - Revenue estimates vs actuals
 *
 * Config shape: { symbols: string[], apiKey?: string, lookbackDays?: number }
 */

import type { DataSource } from '@prisma/client';
import type { RawEvent } from './index.js';
import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';

interface EarningsConfig {
    symbols: string[];
    apiKey?: string;
    lookbackDays?: number; // How far back to fetch (default 90)
    lookforwardDays?: number; // How far forward for upcoming (default 30)
}

const FMP_BASE = 'https://financialmodelingprep.com/api/v3';

/**
 * Fetches earnings data (calendar, surprises) for configured symbols.
 */
export async function fetchEarnings(source: DataSource): Promise<RawEvent[]> {
    const config = source.config as unknown as EarningsConfig;

    if (!config.symbols || config.symbols.length === 0) {
        logger.warn({ sourceId: source.id }, 'Earnings source has no symbols configured');
        return [];
    }

    const apiKey = config.apiKey || env.FMP_API_KEY || '';
    if (!apiKey) {
        logger.warn({ sourceId: source.id }, 'No FMP API key configured for earnings fetcher');
        return [];
    }

    const lookbackDays = config.lookbackDays ?? 90;
    const lookforwardDays = config.lookforwardDays ?? 30;
    const allEvents: RawEvent[] = [];

    // Date range
    const today = new Date();
    const fromDate = new Date(today.getTime() - lookbackDays * 86400000).toISOString().slice(0, 10);
    const toDate = new Date(today.getTime() + lookforwardDays * 86400000).toISOString().slice(0, 10);

    try {
        // 1. Fetch earnings calendar within range
        const calendarUrl = `${FMP_BASE}/earning_calendar?from=${fromDate}&to=${toDate}&apikey=${apiKey}`;
        const calendarRes = await fetch(calendarUrl, { signal: AbortSignal.timeout(15000) });

        if (calendarRes.ok) {
            const calendar = (await calendarRes.json()) as Array<{
                date: string;
                symbol: string;
                eps: number | null;
                epsEstimated: number | null;
                revenue: number | null;
                revenueEstimated: number | null;
                time: string; // "bmo" (before market open) or "amc" (after market close)
                fiscalDateEnding: string;
            }>;

            const symbolSet = new Set(config.symbols.map(s => s.toUpperCase()));

            for (const entry of calendar) {
                if (!symbolSet.has(entry.symbol.toUpperCase())) continue;

                const isUpcoming = new Date(entry.date) > today;
                const epsSurprise = entry.eps != null && entry.epsEstimated != null
                    ? entry.eps - entry.epsEstimated
                    : null;
                const revSurprise = entry.revenue != null && entry.revenueEstimated != null
                    ? entry.revenue - entry.revenueEstimated
                    : null;

                const headline = isUpcoming
                    ? `${entry.symbol} earnings expected ${entry.date} (${entry.time === 'bmo' ? 'Before Market' : 'After Market'})`
                    : `${entry.symbol} reported EPS: $${entry.eps?.toFixed(2) ?? 'N/A'} vs Est: $${entry.epsEstimated?.toFixed(2) ?? 'N/A'}`;

                const body = isUpcoming
                    ? `Estimated EPS: $${entry.epsEstimated?.toFixed(2) ?? 'N/A'}\n` +
                      `Estimated Revenue: $${entry.revenueEstimated ? (entry.revenueEstimated / 1e6).toFixed(1) + 'M' : 'N/A'}\n` +
                      `Fiscal Period: ${entry.fiscalDateEnding}`
                    : `EPS: $${entry.eps?.toFixed(2) ?? 'N/A'} (Est: $${entry.epsEstimated?.toFixed(2) ?? 'N/A'}) | Surprise: ${epsSurprise != null ? (epsSurprise >= 0 ? '+' : '') + epsSurprise.toFixed(2) : 'N/A'}\n` +
                      `Revenue: $${entry.revenue ? (entry.revenue / 1e6).toFixed(1) + 'M' : 'N/A'} (Est: $${entry.revenueEstimated ? (entry.revenueEstimated / 1e6).toFixed(1) + 'M' : 'N/A'}) | Surprise: ${revSurprise != null ? '$' + (revSurprise / 1e6).toFixed(1) + 'M' : 'N/A'}\n` +
                      `Fiscal Period: ${entry.fiscalDateEnding}`;

                allEvents.push({
                    headline,
                    body,
                    symbol: entry.symbol,
                    publishedAt: new Date(entry.date),
                    metadata: {
                        type: 'earnings',
                        isUpcoming,
                        eps: entry.eps,
                        epsEstimated: entry.epsEstimated,
                        epsSurprise,
                        revenue: entry.revenue,
                        revenueEstimated: entry.revenueEstimated,
                        revenueSurprise: revSurprise,
                        time: entry.time,
                        fiscalDateEnding: entry.fiscalDateEnding,
                    },
                });
            }
        } else {
            logger.error({ status: calendarRes.status, sourceId: source.id }, 'FMP earnings calendar request failed');
        }
    } catch (error) {
        logger.error({ error, sourceId: source.id }, 'Failed to fetch earnings data');
    }

    // 2. Fetch earnings surprises for each symbol (historical beat/miss track record)
    for (const symbol of config.symbols) {
        try {
            const surpriseUrl = `${FMP_BASE}/earnings-surprises/${symbol}?apikey=${apiKey}`;
            const surpriseRes = await fetch(surpriseUrl, { signal: AbortSignal.timeout(10000) });

            if (surpriseRes.ok) {
                const surprises = (await surpriseRes.json()) as Array<{
                    date: string;
                    symbol: string;
                    actualEarningResult: number;
                    estimatedEarning: number;
                }>;

                // Only take the most recent 4 surprises
                for (const s of surprises.slice(0, 4)) {
                    const surprise = s.actualEarningResult - s.estimatedEarning;
                    const beatMiss = surprise >= 0 ? 'BEAT' : 'MISS';

                    allEvents.push({
                        headline: `${s.symbol} ${beatMiss} earnings by $${Math.abs(surprise).toFixed(2)} (${s.date})`,
                        body: `Actual: $${s.actualEarningResult.toFixed(2)} | Estimated: $${s.estimatedEarning.toFixed(2)} | Surprise: ${surprise >= 0 ? '+' : ''}$${surprise.toFixed(2)}`,
                        symbol: s.symbol,
                        publishedAt: new Date(s.date),
                        metadata: {
                            type: 'earnings_surprise',
                            actual: s.actualEarningResult,
                            estimated: s.estimatedEarning,
                            surprise,
                            beatMiss,
                        },
                    });
                }
            }
        } catch (error) {
            logger.error({ error, symbol, sourceId: source.id }, 'Failed to fetch earnings surprises');
        }
    }

    logger.info({ sourceId: source.id, eventCount: allEvents.length }, 'Earnings data fetched');
    return allEvents;
}
