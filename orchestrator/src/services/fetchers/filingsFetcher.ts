/**
 * SEC Filings Fetcher — Fetches SEC EDGAR filings (10-K, 10-Q, 8-K, etc.).
 *
 * Uses the SEC EDGAR Full-Text Search API:
 * - https://efts.sec.gov/LATEST/search-index?q=...
 *
 * No API key required — SEC EDGAR is free and public.
 * Respects SEC fair-use: max 10 requests/second, custom User-Agent.
 *
 * Config shape: { symbols: string[], filingTypes?: string[], limit?: number }
 */

import type { DataSource } from '@prisma/client';
import type { RawEvent } from './index.js';
import { logger } from '../../utils/logger.js';

interface FilingsConfig {
    symbols: string[];          // Company tickers to search
    filingTypes?: string[];     // e.g. ["10-K", "10-Q", "8-K", "S-1", "DEF 14A"]
    limit?: number;             // Max results per symbol (default 10)
}

const EDGAR_SEARCH = 'https://efts.sec.gov/LATEST/search-index';
const EDGAR_FILINGS = 'https://data.sec.gov/submissions';
const SEC_USER_AGENT = 'OpenQwnt/1.0 (support@openqwnt.com)';

// CIK lookup cache
const cikCache = new Map<string, string>();

/**
 * Look up CIK for a ticker symbol.
 */
async function lookupCIK(ticker: string): Promise<string | null> {
    if (cikCache.has(ticker)) return cikCache.get(ticker)!;

    try {
        const res = await fetch(
            `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=&CIK=${ticker}&type=&dateb=&owner=include&count=1&search_text=&action=getcompany&output=atom`,
            {
                headers: { 'User-Agent': SEC_USER_AGENT },
                signal: AbortSignal.timeout(10000),
            }
        );

        if (!res.ok) return null;

        const text = await res.text();
        // Extract CIK from Atom feed
        const match = text.match(/CIK=(\d+)/);
        if (match) {
            const cik = match[1].padStart(10, '0');
            cikCache.set(ticker, cik);
            return cik;
        }
    } catch {
        // Fall through to EFTS search
    }

    return null;
}

/**
 * Fetches SEC filings for configured symbols using EDGAR EFTS API.
 */
export async function fetchFilings(source: DataSource): Promise<RawEvent[]> {
    const config = source.config as unknown as FilingsConfig;

    if (!config.symbols || config.symbols.length === 0) {
        logger.warn({ sourceId: source.id }, 'Filings source has no symbols configured');
        return [];
    }

    const filingTypes = config.filingTypes ?? ['10-K', '10-Q', '8-K'];
    const limit = config.limit ?? 10;
    const allEvents: RawEvent[] = [];

    for (const symbol of config.symbols) {
        try {
            // Use EFTS full-text search (no CIK needed)
            const typeFilter = filingTypes.map(t => `"${t}"`).join(' OR ');
            const query = encodeURIComponent(`"${symbol}" AND forms:(${typeFilter})`);

            const searchUrl = `${EDGAR_SEARCH}?q=${query}&dateRange=custom&startdt=${getDateOffset(-90)}&enddt=${getDateOffset(0)}&from=0&size=${limit}`;

            const res = await fetch(searchUrl, {
                headers: {
                    'User-Agent': SEC_USER_AGENT,
                    'Accept': 'application/json',
                },
                signal: AbortSignal.timeout(15000),
            });

            if (!res.ok) {
                // Fallback: try the submissions API with CIK lookup
                await fetchViaSubmissions(symbol, filingTypes, limit, allEvents);
                continue;
            }

            const data = await res.json() as {
                hits?: {
                    hits?: Array<{
                        _source: {
                            file_date: string;
                            display_date_filed: string;
                            form_type: string;
                            entity_name: string;
                            file_num: string;
                            file_description: string;
                            period_of_report?: string;
                        };
                        _id: string;
                    }>;
                    total?: { value: number };
                };
            };

            const hits = data.hits?.hits ?? [];

            for (const hit of hits) {
                const src = hit._source;
                const filingDate = src.display_date_filed || src.file_date;

                const headline = `${symbol} filed ${src.form_type}: ${src.file_description || src.entity_name}`;
                const body = [
                    `Filing Type: ${src.form_type}`,
                    `Entity: ${src.entity_name}`,
                    `Filed: ${filingDate}`,
                    src.period_of_report ? `Period: ${src.period_of_report}` : '',
                    `File #: ${src.file_num}`,
                ].filter(Boolean).join('\n');

                allEvents.push({
                    headline,
                    body,
                    url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${symbol}&type=${src.form_type}&dateb=&owner=include&count=10&search_text=&action=getcompany`,
                    symbol,
                    publishedAt: new Date(filingDate),
                    metadata: {
                        type: 'filing',
                        formType: src.form_type,
                        entityName: src.entity_name,
                        fileNumber: src.file_num,
                        periodOfReport: src.period_of_report,
                        edgarId: hit._id,
                    },
                });
            }

            // Rate limiting: wait 100ms between symbols to respect SEC fair-use
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            logger.error({ error, symbol, sourceId: source.id }, 'Failed to fetch SEC filings');
        }
    }

    logger.info({ sourceId: source.id, eventCount: allEvents.length }, 'SEC filings fetched');
    return allEvents;
}

/**
 * Fallback: fetch filings via the SEC submissions API (needs CIK).
 */
async function fetchViaSubmissions(
    symbol: string,
    filingTypes: string[],
    limit: number,
    allEvents: RawEvent[],
) {
    const cik = await lookupCIK(symbol);
    if (!cik) {
        logger.warn({ symbol }, 'Could not resolve CIK for symbol — skipping filing fetch');
        return;
    }

    try {
        const url = `${EDGAR_FILINGS}/CIK${cik}.json`;
        const res = await fetch(url, {
            headers: {
                'User-Agent': SEC_USER_AGENT,
                'Accept': 'application/json',
            },
            signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) return;

        const data = await res.json() as {
            name: string;
            filings?: {
                recent?: {
                    form: string[];
                    filingDate: string[];
                    accessionNumber: string[];
                    primaryDocument: string[];
                    primaryDocDescription: string[];
                };
            };
        };

        const recent = data.filings?.recent;
        if (!recent) return;

        const typeSet = new Set(filingTypes.map(t => t.toUpperCase()));
        let count = 0;

        for (let i = 0; i < recent.form.length && count < limit; i++) {
            const formType = recent.form[i];
            if (!typeSet.has(formType.toUpperCase())) continue;

            const accession = recent.accessionNumber[i].replace(/-/g, '');
            const doc = recent.primaryDocument[i];

            allEvents.push({
                headline: `${symbol} filed ${formType}: ${recent.primaryDocDescription[i] || data.name}`,
                body: `Filing Type: ${formType}\nEntity: ${data.name}\nFiled: ${recent.filingDate[i]}`,
                url: `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${accession}/${doc}`,
                symbol,
                publishedAt: new Date(recent.filingDate[i]),
                metadata: {
                    type: 'filing',
                    formType,
                    entityName: data.name,
                    accessionNumber: recent.accessionNumber[i],
                },
            });
            count++;
        }
    } catch (error) {
        logger.error({ error, symbol }, 'Failed to fetch filings via submissions API');
    }
}

function getDateOffset(daysOffset: number): string {
    const d = new Date();
    d.setDate(d.getDate() + daysOffset);
    return d.toISOString().slice(0, 10);
}
