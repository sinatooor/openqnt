import { useState, useEffect, useMemo } from 'react';
import {
    Newspaper,
    ChevronRight,
    TrendingUp,
    Clock3,
    Search,
    Filter,
    RefreshCw,
    BarChart3,
    Globe2,
    Building2,
    Sparkles,
} from 'lucide-react';
import { PAGE_CONTENT_CLASS } from '@/components/PageHeader';

interface NewsArticle {
    id: string;
    headline: string;
    summary: string;
    source: string;
    published_at: string;
    url: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    tickers: string[];
}

export default function News() {
    const [news, setNews] = useState<NewsArticle[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [sentimentFilter, setSentimentFilter] = useState<'all' | NewsArticle['sentiment']>('all');
    const [tickerFilter, setTickerFilter] = useState('all');

    useEffect(() => {
        fetchNews();
    }, []);

    const fetchNews = async () => {
        try {
            setLoading(true);
            setError(null);
            const backendUrl = import.meta.env.VITE_PYTHON_BACKEND_URL || 'http://localhost:8000';
            const response = await fetch(`${backendUrl}/api/news/`);
            if (!response.ok) throw new Error('Failed to fetch news');
            const data = await response.json();
            setNews(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const tickerFrequency = useMemo(() => {
        const tickerMap = new Map<string, number>();
        for (const article of news) {
            for (const ticker of article.tickers) {
                tickerMap.set(ticker, (tickerMap.get(ticker) || 0) + 1);
            }
        }

        return Array.from(tickerMap.entries())
            .map(([ticker, mentions]) => ({ ticker, mentions }))
            .sort((a, b) => b.mentions - a.mentions);
    }, [news]);

    const sourceBreakdown = useMemo(() => {
        const sourceMap = new Map<string, number>();
        for (const article of news) {
            sourceMap.set(article.source, (sourceMap.get(article.source) || 0) + 1);
        }

        return Array.from(sourceMap.entries())
            .map(([source, count]) => ({ source, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }, [news]);

    const filteredNews = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        return news.filter((article) => {
            const matchesSentiment = sentimentFilter === 'all' || article.sentiment === sentimentFilter;
            const matchesTicker = tickerFilter === 'all' || article.tickers.includes(tickerFilter);
            const matchesQuery = !query
                || article.headline.toLowerCase().includes(query)
                || article.summary.toLowerCase().includes(query)
                || article.source.toLowerCase().includes(query)
                || article.tickers.some((ticker) => ticker.toLowerCase().includes(query));

            return matchesSentiment && matchesTicker && matchesQuery;
        });
    }, [news, searchQuery, sentimentFilter, tickerFilter]);

    const sentimentCount = useMemo(() => {
        return news.reduce(
            (acc, article) => {
                acc[article.sentiment] += 1;
                return acc;
            },
            { positive: 0, negative: 0, neutral: 0 } as Record<NewsArticle['sentiment'], number>,
        );
    }, [news]);

    const lastUpdated = useMemo(() => {
        if (!news.length) return 'No updates';
        const latest = news.reduce((acc, article) =>
            new Date(article.published_at).getTime() > new Date(acc.published_at).getTime() ? article : acc,
        );
        return new Date(latest.published_at).toLocaleString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }, [news]);

    const totalArticles = news.length;
    const positiveRatio = totalArticles ? Math.round((sentimentCount.positive / totalArticles) * 100) : 0;

    const sentimentStyles: Record<NewsArticle['sentiment'], string> = {
        positive: 'text-emerald-300 bg-emerald-500/15 border border-emerald-500/30',
        negative: 'text-rose-300 bg-rose-500/15 border border-rose-500/30',
        neutral: 'text-slate-300 bg-slate-500/15 border border-slate-500/30',
    };

    return (
        <div className="min-h-screen bg-background pt-20">
            <main className={`p-6 ${PAGE_CONTENT_CLASS} space-y-6`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                            <Newspaper className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-white tracking-tight">Global Market Intelligence</h1>
                            <p className="text-white/50 text-sm mt-0.5">
                                Institutional-style news stream with sentiment and ticker impact tracking.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-white/40">Updated {lastUpdated}</span>
                        <button
                            type="button"
                            onClick={fetchNews}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/75 hover:bg-white/10 transition-colors"
                        >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Refresh
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <div className="text-[11px] uppercase tracking-wide text-white/45">Articles</div>
                        <div className="mt-1 flex items-end justify-between">
                            <span className="text-2xl font-semibold text-white">{totalArticles}</span>
                            <BarChart3 className="w-4 h-4 text-white/40" />
                        </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <div className="text-[11px] uppercase tracking-wide text-white/45">Bullish Share</div>
                        <div className="mt-1 flex items-end justify-between">
                            <span className="text-2xl font-semibold text-emerald-300">{positiveRatio}%</span>
                            <TrendingUp className="w-4 h-4 text-emerald-300/80" />
                        </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <div className="text-[11px] uppercase tracking-wide text-white/45">Tracked Tickers</div>
                        <div className="mt-1 flex items-end justify-between">
                            <span className="text-2xl font-semibold text-white">{tickerFrequency.length}</span>
                            <Building2 className="w-4 h-4 text-white/40" />
                        </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                        <div className="text-[11px] uppercase tracking-wide text-white/45">News Sources</div>
                        <div className="mt-1 flex items-end justify-between">
                            <span className="text-2xl font-semibold text-white">{sourceBreakdown.length}</span>
                            <Globe2 className="w-4 h-4 text-white/40" />
                        </div>
                    </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col lg:flex-row lg:items-center gap-3">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            type="text"
                            placeholder="Search by ticker, source, or topic"
                            className="w-full bg-black/20 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-primary/60"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-white/50" />
                        <select
                            value={sentimentFilter}
                            onChange={(e) => setSentimentFilter(e.target.value as 'all' | NewsArticle['sentiment'])}
                            className="bg-black/20 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-primary/60"
                        >
                            <option value="all">All Sentiment</option>
                            <option value="positive">Positive</option>
                            <option value="negative">Negative</option>
                            <option value="neutral">Neutral</option>
                        </select>
                        <select
                            value={tickerFilter}
                            onChange={(e) => setTickerFilter(e.target.value)}
                            className="bg-black/20 border border-white/10 rounded-lg px-2.5 py-2 text-xs text-white focus:outline-none focus:border-primary/60"
                        >
                            <option value="all">All Tickers</option>
                            {tickerFrequency.slice(0, 12).map(({ ticker }) => (
                                <option key={ticker} value={ticker}>
                                    ${ticker}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-4">
                            {Array.from({ length: 4 }).map((_, idx) => (
                                <div key={idx} className="rounded-xl border border-white/10 bg-white/5 p-5 animate-pulse space-y-3">
                                    <div className="h-4 w-24 bg-white/10 rounded" />
                                    <div className="h-5 w-3/4 bg-white/10 rounded" />
                                    <div className="h-4 w-full bg-white/10 rounded" />
                                    <div className="h-4 w-5/6 bg-white/10 rounded" />
                                </div>
                            ))}
                        </div>
                        <div className="space-y-4">
                            <div className="rounded-xl border border-white/10 bg-white/5 p-5 h-48 animate-pulse" />
                            <div className="rounded-xl border border-white/10 bg-white/5 p-5 h-48 animate-pulse" />
                        </div>
                    </div>
                ) : error ? (
                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 flex items-center justify-between gap-3">
                        <span>{error}</span>
                        <button
                            type="button"
                            onClick={fetchNews}
                            className="px-3 py-1.5 text-xs bg-rose-500/15 border border-rose-500/30 rounded-md hover:bg-rose-500/20 transition-colors"
                        >
                            Try again
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <section className="lg:col-span-2 space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm uppercase tracking-[0.18em] text-white/50 font-medium">Top Stories</h2>
                                <span className="text-xs text-white/40">{filteredNews.length} matching articles</span>
                            </div>

                            {filteredNews.length === 0 && (
                                <div className="rounded-xl border border-white/10 bg-white/5 p-8 text-center text-white/55">
                                    No articles match your current filters.
                                </div>
                            )}

                            {filteredNews.map((article) => (
                                <article
                                    key={article.id}
                                    className="rounded-xl border border-white/10 bg-white/5 p-5 hover:bg-white/[0.07] hover:border-white/20 transition-colors group"
                                >
                                    <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-[11px] uppercase tracking-[0.14em] text-white/45">{article.source}</span>
                                            <span className={`px-2 py-0.5 text-[10px] rounded-md font-medium ${sentimentStyles[article.sentiment]}`}>
                                                {article.sentiment}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1 text-xs text-white/40">
                                            <Clock3 className="w-3.5 h-3.5" />
                                            <span>
                                                {new Date(article.published_at).toLocaleString([], {
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </span>
                                        </div>
                                    </div>

                                    <h3 className="text-lg font-semibold text-white mb-2 leading-tight group-hover:text-primary transition-colors">
                                        {article.headline}
                                    </h3>
                                    <p className="text-sm text-white/60 leading-relaxed mb-4 line-clamp-3">{article.summary}</p>

                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div className="flex flex-wrap gap-1.5">
                                            {article.tickers.map((ticker) => (
                                                <button
                                                    type="button"
                                                    key={`${article.id}-${ticker}`}
                                                    onClick={() => setTickerFilter(ticker)}
                                                    className="px-2 py-1 rounded-md text-[11px] font-medium bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition-colors"
                                                >
                                                    ${ticker}
                                                </button>
                                            ))}
                                        </div>
                                        <a
                                            href={article.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 text-sm text-primary hover:text-primary/80 transition-colors"
                                        >
                                            Open story
                                            <ChevronRight className="w-4 h-4" />
                                        </a>
                                    </div>
                                </article>
                            ))}
                        </section>

                        <aside className="space-y-4">
                            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-semibold text-white/90">Sentiment Pulse</h3>
                                    <Sparkles className="w-4 h-4 text-primary/80" />
                                </div>
                                <div className="space-y-3">
                                    {(['positive', 'neutral', 'negative'] as NewsArticle['sentiment'][]).map((sentiment) => {
                                        const total = totalArticles || 1;
                                        const percentage = Math.round((sentimentCount[sentiment] / total) * 100);
                                        return (
                                            <div key={sentiment}>
                                                <div className="flex items-center justify-between text-xs text-white/70 mb-1">
                                                    <span className="capitalize">{sentiment}</span>
                                                    <span>
                                                        {sentimentCount[sentiment]} ({percentage}%)
                                                    </span>
                                                </div>
                                                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                                    <div
                                                        className={`h-full ${
                                                            sentiment === 'positive'
                                                                ? 'bg-emerald-400'
                                                                : sentiment === 'negative'
                                                                    ? 'bg-rose-400'
                                                                    : 'bg-slate-300'
                                                        }`}
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                                <h3 className="text-sm font-semibold text-white/90 mb-4">Most Mentioned Tickers</h3>
                                <div className="space-y-2">
                                    {tickerFrequency.slice(0, 6).map((item) => (
                                        <button
                                            type="button"
                                            key={item.ticker}
                                            onClick={() => setTickerFilter(item.ticker)}
                                            className="w-full flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-left hover:bg-white/5 transition-colors"
                                        >
                                            <span className="text-sm font-medium text-white">${item.ticker}</span>
                                            <span className="text-xs text-white/55">{item.mentions} mentions</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                                <h3 className="text-sm font-semibold text-white/90 mb-4">Source Coverage</h3>
                                <div className="space-y-2.5">
                                    {sourceBreakdown.map((item) => {
                                        const pct = totalArticles ? Math.round((item.count / totalArticles) * 100) : 0;
                                        return (
                                            <div key={item.source}>
                                                <div className="flex items-center justify-between text-xs text-white/70 mb-1">
                                                    <span className="truncate max-w-[70%]">{item.source}</span>
                                                    <span>{item.count}</span>
                                                </div>
                                                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                                                    <div className="h-full bg-primary/70" style={{ width: `${pct}%` }} />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </aside>
                    </div>
                )}
            </main>
        </div>
    );
}
