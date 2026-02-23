import Parser from 'rss-parser';
import { logger } from '../utils/logger.js';

const parser = new Parser({
    headers: {
        Accept: 'application/rss+xml, application/rdf+xml;q=0.8, application/atom+xml;q=0.6, application/xml;q=0.4, text/xml;q=0.4',
    },
});

export interface NewsArticle {
    title: string;
    link: string;
    pubDate: string;
    contentSnippet: string;
    sourceFeed: string;
}

export class NewsService {
    /**
     * Fetches and parses an RSS feed, returning standardized articles.
     */
    static async fetchFeed(url: string, limit = 10): Promise<NewsArticle[]> {
        try {
            const feed = await parser.parseURL(url);

            if (!feed.items) return [];

            return feed.items.slice(0, limit).map(item => ({
                title: item.title ?? 'No Title',
                link: item.link ?? '',
                pubDate: item.pubDate ?? new Date().toISOString(),
                contentSnippet: item.contentSnippet ?? item.content ?? '',
                sourceFeed: url,
            }));
        } catch (error) {
            logger.error({ error, url }, 'Failed to parse RSS feed');
            return [];
        }
    }
}
