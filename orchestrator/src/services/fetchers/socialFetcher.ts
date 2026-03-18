import type { DataSource } from '@prisma/client';
import type { RawEvent } from './index.js';
import { logger } from '../../utils/logger.js';

// ─── Social Media Fetcher ─────────────────────────────────────
// Monitors public social media feeds for influential accounts.
// Designed for the user's use case: monitor Trump's Truth Social,
// key finance accounts, and Reddit for portfolio-impacting posts.
//
// Strategy: scrape public RSS/web endpoints (no API keys needed
// for public posts) and fallback to web scraping as needed.

interface SocialSourceConfig {
    accounts: SocialAccount[];
    redditSubreddits?: string[];  // e.g. ['wallstreetbets', 'stocks']
    symbols?: string[];           // Tag posts mentioning these symbols
    limit?: number;               // Max posts per source
}

interface SocialAccount {
    platform: 'twitter' | 'truth_social' | 'reddit' | 'other';
    handle: string;               // Username or URL
    rssUrl?: string;              // Direct RSS feed URL (e.g., Nitter for Twitter)
}

/**
 * Fetches social media posts from configured accounts and subreddits.
 * Config shape: { accounts: [...], redditSubreddits?: [...], symbols?: [...] }
 */
export async function fetchSocial(source: DataSource): Promise<RawEvent[]> {
    const config = source.config as unknown as SocialSourceConfig;
    const events: RawEvent[] = [];
    const limit = config.limit ?? 20;
    const symbolSet = new Set((config.symbols ?? []).map(s => s.toUpperCase()));

    // ── Reddit RSS (public, no API key needed) ──
    if (config.redditSubreddits?.length) {
        for (const subreddit of config.redditSubreddits) {
            try {
                const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=${limit}`;
                const response = await fetch(url, {
                    headers: { 'User-Agent': 'OpenQwnt/1.0 (investment research)' },
                });

                if (!response.ok) {
                    logger.warn({ subreddit, status: response.status }, 'Reddit API request failed');
                    continue;
                }

                const data = await response.json() as any;
                const posts = data?.data?.children ?? [];

                for (const post of posts) {
                    const { title, selftext, url: postUrl, created_utc, author, score, num_comments } = post.data;

                    const matchedSymbol = detectSymbol(title + ' ' + (selftext ?? ''), symbolSet);

                    events.push({
                        headline: title,
                        body: (selftext ?? '').slice(0, 3000),
                        url: `https://reddit.com${post.data.permalink}`,
                        symbol: matchedSymbol,
                        publishedAt: new Date(created_utc * 1000),
                        metadata: {
                            platform: 'reddit',
                            subreddit,
                            author,
                            score,
                            numComments: num_comments,
                            originalUrl: postUrl,
                        },
                    });
                }
            } catch (error) {
                logger.error({ error, subreddit, sourceId: source.id }, 'Failed to fetch Reddit');
            }
        }
    }

    // ── Account-based feeds (Twitter/Nitter RSS, Truth Social, etc.) ──
    if (config.accounts?.length) {
        for (const account of config.accounts) {
            try {
                let feedUrl: string | undefined;

                if (account.rssUrl) {
                    // Direct RSS URL provided
                    feedUrl = account.rssUrl;
                } else if (account.platform === 'twitter') {
                    // Try Nitter instances for public Twitter RSS
                    feedUrl = `https://nitter.privacydev.net/${account.handle}/rss`;
                } else if (account.platform === 'truth_social') {
                    // Truth Social doesn't have RSS — use web scraping approach
                    const posts = await fetchTruthSocialPosts(account.handle, limit);
                    for (const post of posts) {
                        const matchedSymbol = detectSymbol(post.content, symbolSet);
                        events.push({
                            headline: `@${account.handle}: ${post.content.slice(0, 100)}`,
                            body: post.content,
                            url: post.url,
                            symbol: matchedSymbol,
                            publishedAt: post.createdAt,
                            metadata: {
                                platform: 'truth_social',
                                handle: account.handle,
                            },
                        });
                    }
                    continue;
                }

                if (feedUrl) {
                    const Parser = (await import('rss-parser')).default;
                    const parser = new Parser({ timeout: 15_000 });
                    const feed = await parser.parseURL(feedUrl);

                    for (const item of (feed.items ?? []).slice(0, limit)) {
                        const content = item.contentSnippet ?? item.content ?? '';
                        const matchedSymbol = detectSymbol(item.title + ' ' + content, symbolSet);

                        events.push({
                            headline: item.title ?? `@${account.handle} post`,
                            body: content.slice(0, 3000),
                            url: item.link ?? undefined,
                            symbol: matchedSymbol,
                            publishedAt: item.pubDate ? new Date(item.pubDate) : undefined,
                            metadata: {
                                platform: account.platform,
                                handle: account.handle,
                            },
                        });
                    }
                }
            } catch (error) {
                logger.error({ error, account, sourceId: source.id }, 'Failed to fetch social account');
            }
        }
    }

    return events;
}

// ─── Truth Social Scraper ─────────────────────────────────────
// Minimal scraper for public Truth Social profiles.

interface TruthSocialPost {
    content: string;
    url: string;
    createdAt: Date;
}

async function fetchTruthSocialPosts(handle: string, limit: number): Promise<TruthSocialPost[]> {
    try {
        // Truth Social uses Mastodon API under the hood
        const url = `https://truthsocial.com/api/v1/accounts/lookup?acct=${handle}`;
        const lookupResponse = await fetch(url, {
            headers: { 'User-Agent': 'OpenQwnt/1.0' },
        });

        if (!lookupResponse.ok) {
            logger.warn({ handle, status: lookupResponse.status }, 'Truth Social lookup failed');
            return [];
        }

        const account = await lookupResponse.json() as any;
        const accountId = account.id;

        if (!accountId) return [];

        const statusesUrl = `https://truthsocial.com/api/v1/accounts/${accountId}/statuses?limit=${limit}&exclude_replies=true`;
        const statusesResponse = await fetch(statusesUrl, {
            headers: { 'User-Agent': 'OpenQwnt/1.0' },
        });

        if (!statusesResponse.ok) {
            logger.warn({ handle, status: statusesResponse.status }, 'Truth Social statuses failed');
            return [];
        }

        const statuses = await statusesResponse.json() as any[];

        return statuses.map(status => ({
            content: stripHtml(status.content ?? ''),
            url: status.url ?? `https://truthsocial.com/@${handle}/${status.id}`,
            createdAt: new Date(status.created_at),
        }));
    } catch (error) {
        logger.error({ error, handle }, 'Truth Social fetch failed');
        return [];
    }
}

// ─── Helpers ──────────────────────────────────────────────────

function stripHtml(html: string): string {
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .trim();
}

function detectSymbol(text: string, symbolSet: Set<string>): string | undefined {
    if (symbolSet.size === 0) return undefined;
    const upper = text.toUpperCase();
    for (const sym of symbolSet) {
        // Match $TICKER, standalone TICKER (word boundary), etc.
        if (upper.includes(`$${sym}`) || new RegExp(`\\b${sym}\\b`).test(upper)) {
            return sym;
        }
    }
    return undefined;
}
