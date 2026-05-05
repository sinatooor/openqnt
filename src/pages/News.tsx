import { useState, useEffect, useMemo, useCallback } from 'react';
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
    Brain,
    Target,
    ArrowRight,
    Loader2,
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

interface NewsAnalysis {
    summary: string;
    overall_sentiment: string;
    key_takeaways: string[];
    market_impact: string;
}

interface NewsResponse {
    articles: NewsArticle[];
    analysis: NewsAnalysis | null;
    query: string;
    category: string;
}

const MARKET_PRESETS = [
    { key: 'global', label: 'Global Markets' },
    { key: 'tech', label: 'Tech & AI' },
    { key: 'energy', label: 'Energy' },
    { key: 'crypto', label: 'Crypto' },
    { key: 'healthcare', label: 'Healthcare' },
    { key: 'finance', label: 'Finance' },
    { key: 'commodities', label: 'Commodities' },
];

const POPULAR_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'TSLA', 'GOOGL', 'AMZN', 'META', 'JPM'];

export default function News() {
    const [news, setNews] = useState<NewsArticle[]>([]);
    const [analysis, setAnalysis] = useState<NewsAnalysis | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [category, setCategory] = useState<'company' | 'market'>('market');
    const [searchInput, setSearchInput] = useState('');
    const [activePreset, setActivePreset] = useState('global');
    const [activeLabel, setActiveLabel] = useState('Global Markets');

    const [filterQuery, setFilterQuery] = useState('');
    const [sentimentFilter, setSentimentFilter] = useState<'all' | NewsArticle['sentiment']>('all');
    const [tickerFilter, setTickerFilter] = useState('all');

    const fetchNews = useCallback(async (query: string, cat: string) => {
        try {
            setLoading(true);
            setError(null);
            const backendUrl = import.meta.env.VITE_PYTHON_BACKEND_URL || 'http://localhost:8000';
            const params = new URLSearchParams({ query, category: cat });
            const response = await fetch(`${backendUrl}/api/news/?${params}`);
            if (!response.ok) {
                const detail = await response.json().catch(() => ({}));
                throw new Error(detail.detail || `Failed to fetch news (${response.status})`);
            }
            const data: NewsResponse = await response.json();
            setNews(data.articles);
            setAnalysis(data.analysis);
            setFilterQuery('');
            setSentimentFilter('all');
            setTickerFilter('all');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchNews('global', 'market');
    }, [fetchNews]);

    const handlePresetClick = (key: string, label: string) => {
        setActivePreset(key);
        setActiveLabel(label);
        setSearchInput('');
        setCategory('market');
        fetchNews(key, 'market');
    };

    const handleCompanySearch = () => {
        const q = searchInput.trim().toUpperCase();
        if (!q) return;
        setActivePreset('');
        setActiveLabel(q);
        fetchNews(q, 'company');
    };

    const handleMarketCustomSearch = () => {
        const q = searchInput.trim();
        if (!q) return;
        setActivePreset('');
        setActiveLabel(q);
        fetchNews(q, 'market');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            if (category === 'company') handleCompanySearch();
            else handleMarketCustomSearch();
        }
    };

    const tickerFrequency = useMemo(() => {
        const map = new Map<string, number>();
        for (const article of news) {
            for (const ticker of article.tickers) {
                map.set(ticker, (map.get(ticker) || 0) + 1);
            }
        }
        return Array.from(map.entries())
            .map(([ticker, mentions]) => ({ ticker, mentions }))
            .sort((a, b) => b.mentions - a.mentions);
    }, [news]);

    const sourceBreakdown = useMemo(() => {
        const map = new Map<string, number>();
        for (const article of news) {
            map.set(article.source, (map.get(article.source) || 0) + 1);
        }
        return Array.from(map.entries())
            .map(([source, count]) => ({ source, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }, [news]);

    const filteredNews = useMemo(() => {
        const q = filterQuery.trim().toLowerCase();
        return news.filter((article) => {
            const matchSentiment = sentimentFilter === 'all' || article.sentiment === sentimentFilter;
            const matchTicker = tickerFilter === 'all' || article.tickers.includes(tickerFilter);
            const matchQuery =
                !q ||
                article.headline.toLowerCase().includes(q) ||
                article.summary.toLowerCase().includes(q) ||
                article.source.toLowerCase().includes(q) ||
                article.tickers.some((t) => t.toLowerCase().includes(q));
            return matchSentiment && matchTicker && matchQuery;
        });
    }, [news, filterQuery, sentimentFilter, tickerFilter]);

    const sentimentCount = useMemo(
        () =>
            news.reduce(
                (acc, a) => {
                    acc[a.sentiment] += 1;
                    return acc;
                },
                { positive: 0, negative: 0, neutral: 0 } as Record<NewsArticle['sentiment'], number>,
            ),
        [news],
    );

    const lastUpdated = useMemo(() => {
        if (!news.length) return 'No updates';
        const latest = news.reduce((a, b) =>
            new Date(a.published_at).getTime() > new Date(b.published_at).getTime() ? a : b,
        news[0]);
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
        <div className="min-h-screen bg-background pt-14">
            <main className={`p-6 ${PAGE_CONTENT_CLASS} space-y-6`}>
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                            <Newspaper className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-xl font-semibold text-white tracking-tight">
                                Market Intelligence
                            </h1>
                            <p className="text-white/50 text-sm mt-0.5">
                                Real-time news with AI-powered sentiment analysis
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-white/40">Updated {lastUpdated}</span>
                        <button
                            type="button"
                            onClick={() => fetchNews(activePreset || searchInput || 'global', category)}
                            disabled={loading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/75 hover:bg-white/10 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                            Refresh
                        </button>
                    </div>
                </div>

                {/* Category Toggle + Search */}
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-4">
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1 p-1 rounded-lg bg-black/30 border border-white/10">
                            <button
                                type="button"
                                onClick={() => setCategory('market')}
                                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                                    category === 'market'
                                        ? 'bg-primary/20 text-primary border border-primary/30'
                                        : 'text-white/55 hover:text-white/80 border border-transparent'
                                }`}
                            >
                                <Globe2 className="w-3.5 h-3.5" />
                                Market
                            </button>
                            <button
                                type="button"
                                onClick={() => setCategory('company')}
                                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                                    category === 'company'
                                        ? 'bg-primary/20 text-primary border border-primary/30'
                                        : 'text-white/55 hover:text-white/80 border border-transparent'
                                }`}
                            >
                                <Building2 className="w-3.5 h-3.5" />
                                Company
                            </button>
                        </div>

                        <div className="flex-1 flex items-center gap-2 min-w-[200px]">
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 text-white/35 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder={
                                        category === 'company'
                                            ? 'Enter ticker symbol (e.g. AAPL, TSLA, NVDA)'
                                            : 'Search market topic (e.g. AI stocks, oil prices)'
                                    }
                                    className="w-full bg-black/20 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-primary/50 transition-colors"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={
                                    category === 'company'
                                        ? handleCompanySearch
                                        : handleMarketCustomSearch
                                }
                                disabled={!searchInput.trim() || loading}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/20 border border-primary/30 text-primary text-xs font-medium hover:bg-primary/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {loading ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <ArrowRight className="w-3.5 h-3.5" />
                                )}
                                Search
                            </button>
                        </div>
                    </div>

                    {/* Market Presets */}
                    {category === 'market' && (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] text-white/40 uppercase tracking-wide mr-1">Sectors:</span>
                            {MARKET_PRESETS.map((preset) => (
                                <button
                                    key={preset.key}
                                    type="button"
                                    onClick={() => handlePresetClick(preset.key, preset.label)}
                                    disabled={loading}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                        activePreset === preset.key
                                            ? 'bg-primary/20 text-primary border border-primary/30'
                                            : 'bg-black/20 text-white/55 border border-white/10 hover:text-white/80 hover:border-white/20'
                                    } disabled:opacity-50`}
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Popular Tickers */}
                    {category === 'company' && (
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] text-white/40 uppercase tracking-wide mr-1">Popular:</span>
                            {POPULAR_TICKERS.map((ticker) => (
                                <button
                                    key={ticker}
                                    type="button"
                                    onClick={() => {
                                        setSearchInput(ticker);
                                        setActivePreset('');
                                        setActiveLabel(ticker);
                                        fetchNews(ticker, 'company');
                                    }}
                                    disabled={loading}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-black/20 text-white/55 border border-white/10 hover:text-white/80 hover:border-white/20 transition-all disabled:opacity-50"
                                >
                                    ${ticker}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Stat Cards */}
                {!loading && !error && news.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                            <div className="text-[11px] uppercase tracking-wide text-white/45">
                                Articles
                            </div>
                            <div className="mt-1 flex items-end justify-between">
                                <span className="text-2xl font-semibold text-white">{totalArticles}</span>
                                <BarChart3 className="w-4 h-4 text-white/40" />
                            </div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                            <div className="text-[11px] uppercase tracking-wide text-white/45">
                                Bullish Share
                            </div>
                            <div className="mt-1 flex items-end justify-between">
                                <span className="text-2xl font-semibold text-emerald-300">
                                    {positiveRatio}%
                                </span>
                                <TrendingUp className="w-4 h-4 text-emerald-300/80" />
                            </div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                            <div className="text-[11px] uppercase tracking-wide text-white/45">
                                Tracked Tickers
                            </div>
                            <div className="mt-1 flex items-end justify-between">
                                <span className="text-2xl font-semibold text-white">
                                    {tickerFrequency.length}
                                </span>
                                <Building2 className="w-4 h-4 text-white/40" />
                            </div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                            <div className="text-[11px] uppercase tracking-wide text-white/45">
                                News Sources
                            </div>
                            <div className="mt-1 flex items-end justify-between">
                                <span className="text-2xl font-semibold text-white">
                                    {sourceBreakdown.length}
                                </span>
                                <Globe2 className="w-4 h-4 text-white/40" />
                            </div>
                        </div>
                    </div>
                )}

                {/* Filter Bar */}
                {!loading && !error && news.length > 0 && (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col lg:flex-row lg:items-center gap-3">
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                value={filterQuery}
                                onChange={(e) => setFilterQuery(e.target.value)}
                                placeholder="Filter results by ticker, source, or keyword"
                                className="w-full bg-black/20 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-primary/60"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Filter className="w-4 h-4 text-white/50" />
                            <select
                                value={sentimentFilter}
                                onChange={(e) =>
                                    setSentimentFilter(e.target.value as 'all' | NewsArticle['sentiment'])
                                }
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
                )}

                {/* Content */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 space-y-4">
                        <div className="relative">
                            <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                            </div>
                        </div>
                        <div className="text-center">
                            <p className="text-sm text-white/70">Searching for latest news</p>
                            <p className="text-xs text-white/40 mt-1">
                                Analyzing {activeLabel} with AI...
                            </p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="p-5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 flex items-center justify-between gap-3">
                        <span className="text-sm">{error}</span>
                        <button
                            type="button"
                            onClick={() =>
                                fetchNews(activePreset || searchInput || 'global', category)
                            }
                            className="px-3 py-1.5 text-xs bg-rose-500/15 border border-rose-500/30 rounded-md hover:bg-rose-500/20 transition-colors shrink-0"
                        >
                            Try again
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Articles */}
                        <section className="lg:col-span-2 space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm uppercase tracking-[0.18em] text-white/50 font-medium">
                                    Top Stories
                                </h2>
                                <span className="text-xs text-white/40">
                                    {filteredNews.length} matching articles
                                </span>
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
                                            <span className="text-[11px] uppercase tracking-[0.14em] text-white/45">
                                                {article.source}
                                            </span>
                                            <span
                                                className={`px-2 py-0.5 text-[10px] rounded-md font-medium ${sentimentStyles[article.sentiment]}`}
                                            >
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
                                    <p className="text-sm text-white/60 leading-relaxed mb-4 line-clamp-3">
                                        {article.summary}
                                    </p>

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

                        {/* Sidebar */}
                        <aside className="space-y-4">
                            {/* AI Analysis Card */}
                            {analysis && (
                                <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-5">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Brain className="w-4 h-4 text-primary" />
                                        <h3 className="text-sm font-semibold text-white/90">
                                            AI Analysis
                                        </h3>
                                        <span
                                            className={`ml-auto px-2 py-0.5 rounded-md text-[10px] font-medium ${
                                                analysis.overall_sentiment === 'positive'
                                                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                                    : analysis.overall_sentiment === 'negative'
                                                      ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                                                      : 'bg-slate-500/15 text-slate-300 border border-slate-500/30'
                                            }`}
                                        >
                                            {analysis.overall_sentiment}
                                        </span>
                                    </div>
                                    <p className="text-sm text-white/70 leading-relaxed mb-4">
                                        {analysis.summary}
                                    </p>

                                    {analysis.key_takeaways.length > 0 && (
                                        <div className="space-y-2 mb-4">
                                            <h4 className="text-[11px] text-white/45 uppercase tracking-wide">
                                                Key Takeaways
                                            </h4>
                                            {analysis.key_takeaways.map((point) => (
                                                <div key={point} className="flex items-start gap-2">
                                                    <Target className="w-3.5 h-3.5 text-primary/60 mt-0.5 shrink-0" />
                                                    <span className="text-xs text-white/60 leading-relaxed">
                                                        {point}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {analysis.market_impact && (
                                        <div className="pt-3 border-t border-white/10">
                                            <h4 className="text-[11px] text-white/45 uppercase tracking-wide mb-1.5">
                                                Market Impact
                                            </h4>
                                            <p className="text-xs text-white/60 leading-relaxed">
                                                {analysis.market_impact}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Sentiment Pulse */}
                            <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-semibold text-white/90">
                                        Sentiment Pulse
                                    </h3>
                                    <Sparkles className="w-4 h-4 text-primary/80" />
                                </div>
                                <div className="space-y-3">
                                    {(
                                        ['positive', 'neutral', 'negative'] as NewsArticle['sentiment'][]
                                    ).map((sentiment) => {
                                        const total = totalArticles || 1;
                                        const pct = Math.round(
                                            (sentimentCount[sentiment] / total) * 100,
                                        );
                                        return (
                                            <div key={sentiment}>
                                                <div className="flex items-center justify-between text-xs text-white/70 mb-1">
                                                    <span className="capitalize">{sentiment}</span>
                                                    <span>
                                                        {sentimentCount[sentiment]} ({pct}%)
                                                    </span>
                                                </div>
                                                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                                                    <div
                                                        className={`h-full transition-all duration-500 ${
                                                            sentiment === 'positive'
                                                                ? 'bg-emerald-400'
                                                                : sentiment === 'negative'
                                                                  ? 'bg-rose-400'
                                                                  : 'bg-slate-300'
                                                        }`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Most Mentioned Tickers */}
                            {tickerFrequency.length > 0 && (
                                <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                                    <h3 className="text-sm font-semibold text-white/90 mb-4">
                                        Most Mentioned Tickers
                                    </h3>
                                    <div className="space-y-2">
                                        {tickerFrequency.slice(0, 6).map((item) => (
                                            <button
                                                type="button"
                                                key={item.ticker}
                                                onClick={() => setTickerFilter(item.ticker)}
                                                className="w-full flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-left hover:bg-white/5 transition-colors"
                                            >
                                                <span className="text-sm font-medium text-white">
                                                    ${item.ticker}
                                                </span>
                                                <span className="text-xs text-white/55">
                                                    {item.mentions} mentions
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Source Coverage */}
                            {sourceBreakdown.length > 0 && (
                                <div className="rounded-xl border border-white/10 bg-white/5 p-5">
                                    <h3 className="text-sm font-semibold text-white/90 mb-4">
                                        Source Coverage
                                    </h3>
                                    <div className="space-y-2.5">
                                        {sourceBreakdown.map((item) => {
                                            const pct = totalArticles
                                                ? Math.round((item.count / totalArticles) * 100)
                                                : 0;
                                            return (
                                                <div key={item.source}>
                                                    <div className="flex items-center justify-between text-xs text-white/70 mb-1">
                                                        <span className="truncate max-w-[70%]">
                                                            {item.source}
                                                        </span>
                                                        <span>{item.count}</span>
                                                    </div>
                                                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                                                        <div
                                                            className="h-full bg-primary/70 transition-all duration-500"
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </aside>
                    </div>
                )}
            </main>
        </div>
    );
}
