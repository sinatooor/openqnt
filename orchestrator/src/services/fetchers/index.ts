import type { DataSourceType, DataSource } from '@prisma/client';

// ─── Raw Event Interface ──────────────────────────────────────
// Every fetcher returns an array of these. The ingestion service
// then converts them into DataEvent records with dedup.

export interface RawEvent {
    headline: string;
    body?: string;
    url?: string;
    symbol?: string;
    publishedAt?: Date;
    metadata?: Record<string, unknown>;
}

// ─── Fetcher Function Signature ───────────────────────────────
// Each data source type has a fetcher that knows how to pull data
// from its specific provider and return standardized RawEvents.

export type FetcherFn = (source: DataSource) => Promise<RawEvent[]>;

// ─── Fetcher Registry ─────────────────────────────────────────
// Maps DataSourceType → fetcher function. New source types are
// registered here as they are built.

import { fetchNews } from './newsFetcher.js';
import { fetchMacro } from './macroFetcher.js';
import { fetchSocial } from './socialFetcher.js';
import { fetchInsider } from './insiderFetcher.js';
import { fetchEarnings } from './earningsFetcher.js';
import { fetchFilings } from './filingsFetcher.js';

const fetcherRegistry: Partial<Record<DataSourceType, FetcherFn>> = {
    news: fetchNews,
    macro: fetchMacro,
    social: fetchSocial,
    insider: fetchInsider,
    earnings: fetchEarnings,
    filing: fetchFilings,
    // Future fetchers:
    // congress: fetchCongress,
    // whale_13f: fetchWhale13F,
    // analyst: fetchAnalyst,
    // options: fetchOptions,
    // crypto_whale: fetchCryptoWhale,
};

export function getFetcher(type: DataSourceType): FetcherFn | undefined {
    return fetcherRegistry[type];
}

export function getRegisteredTypes(): DataSourceType[] {
    return Object.keys(fetcherRegistry) as DataSourceType[];
}
