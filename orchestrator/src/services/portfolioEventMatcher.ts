import { prisma } from '../config/database.js';
import type { DataSourceType, DataEventImpact } from '@prisma/client';
import { logger } from '../utils/logger.js';

// ─── Portfolio Event Matcher ──────────────────────────────────
// Matches data events against a user's portfolio holdings.
// Used by the /data-events/portfolio/:userId endpoint to show
// only events relevant to the user's actual positions.

interface PortfolioMatchResult {
    events: Array<{
        id: string;
        type: DataSourceType;
        headline: string;
        body: string | null;
        url: string | null;
        symbol: string | null;
        sentiment: number | null;
        impact: DataEventImpact;
        publishedAt: Date | null;
        ingestedAt: Date;
        matchedSymbol: string | null;
        relevanceScore: number;
        sourceName: string | null;
    }>;
    total: number;
    portfolioSymbols: string[];
}

export class PortfolioEventMatcher {
    /**
     * Find data events that match a user's portfolio holdings.
     */
    static async getPortfolioEvents(params: {
        userId: string;
        types?: DataSourceType[];
        from?: Date;
        to?: Date;
        limit?: number;
        offset?: number;
    }): Promise<PortfolioMatchResult> {
        const { userId, types, from, to, limit = 50, offset = 0 } = params;

        // 1. Get user's portfolio symbols
        const portfolios = await prisma.portfolio.findMany({
            where: { userId },
            include: {
                positions: {
                    select: { symbol: true },
                },
            },
        });

        const symbolSet = new Set<string>();
        for (const portfolio of portfolios) {
            for (const pos of portfolio.positions) {
                symbolSet.add(pos.symbol.toUpperCase());
            }
        }

        const portfolioSymbols = Array.from(symbolSet);

        if (portfolioSymbols.length === 0) {
            logger.debug({ userId }, 'User has no portfolio positions for event matching');
            return { events: [], total: 0, portfolioSymbols: [] };
        }

        // 2. Query events matching any of the user's symbols
        const where: any = {
            symbol: { in: portfolioSymbols },
        };

        if (types && types.length > 0) {
            where.type = { in: types };
        }

        if (from || to) {
            where.publishedAt = {};
            if (from) where.publishedAt.gte = from;
            if (to) where.publishedAt.lte = to;
        }

        const [events, total] = await Promise.all([
            prisma.dataEvent.findMany({
                where,
                orderBy: { ingestedAt: 'desc' },
                take: limit,
                skip: offset,
                include: {
                    dataSource: { select: { name: true } },
                },
            }),
            prisma.dataEvent.count({ where }),
        ]);

        // 3. Score relevance
        const scoredEvents = events.map(event => ({
            id: event.id,
            type: event.type,
            headline: event.headline,
            body: event.body,
            url: event.url,
            symbol: event.symbol,
            sentiment: event.sentiment,
            impact: event.impact,
            publishedAt: event.publishedAt,
            ingestedAt: event.ingestedAt,
            matchedSymbol: event.symbol,
            relevanceScore: this.calculateRelevanceScore(event),
            sourceName: event.dataSource?.name ?? null,
        }));

        // Sort by relevance score descending
        scoredEvents.sort((a, b) => b.relevanceScore - a.relevanceScore);

        return {
            events: scoredEvents,
            total,
            portfolioSymbols,
        };
    }

    /**
     * Calculate a relevance score for a data event.
     * Higher is more relevant.
     */
    private static calculateRelevanceScore(event: {
        symbol: string | null;
        impact: DataEventImpact;
        sentiment: number | null;
    }): number {
        let score = 0;

        // Symbol match
        if (event.symbol) score += 1.0;

        // Impact level
        const impactWeights: Record<DataEventImpact, number> = {
            none: 0,
            low: 0.1,
            medium: 0.3,
            high: 0.6,
            critical: 1.0,
        };
        score += impactWeights[event.impact] ?? 0;

        // Strong sentiment (positive or negative) is more relevant
        if (event.sentiment !== null) {
            score += Math.abs(event.sentiment) * 0.5;
        }

        return Math.round(score * 100) / 100;
    }
}
