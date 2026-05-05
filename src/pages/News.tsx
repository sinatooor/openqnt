/**
 * News — Market Intelligence feed with AI sentiment analysis.
 *
 * Layout: sticky page header • category + search card • stat row •
 * filter row • two-column content (articles | sidebar with AI analysis,
 * sentiment pulse, top tickers, sources). All colors driven by design
 * tokens so the page follows the active theme.
 */

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
    AlertCircle,
    Hash,
} from 'lucide-react';
import { PAGE_CONTENT_CLASS } from '@/components/PageHeader';
import { usePageContext, AskAi } from '@/features/ai-chat';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

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

/* -------------------------------------------------------------------------- */
/*  Helpers — sentiment styling driven by design tokens so themes adapt       */
/* -------------------------------------------------------------------------- */

const sentimentBadgeClass: Record<NewsArticle['sentiment'], string> = {
    positive: 'border-profit/40 bg-profit/10 text-profit',
    negative: 'border-loss/40 bg-loss/10 text-loss',
    neutral: 'border-muted-foreground/30 bg-muted/30 text-muted-foreground',
};

const sentimentBarClass: Record<NewsArticle['sentiment'], string> = {
    positive: 'bg-profit',
    negative: 'bg-loss',
    neutral: 'bg-muted-foreground',
};

const formatPublishedAt = (iso: string) =>
    new Date(iso).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

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

    usePageContext({
        page: 'news',
        visibleData: {
            kind: 'news_feed',
            snapshot: { category, preset: activePreset, label: activeLabel, count: news.length },
        },
    });

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

    /* Aggregations -------------------------------------------------------- */

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
        const latest = news.reduce(
            (a, b) =>
                new Date(a.published_at).getTime() > new Date(b.published_at).getTime() ? a : b,
            news[0],
        );
        return formatPublishedAt(latest.published_at);
    }, [news]);

    const totalArticles = news.length;
    const positiveRatio = totalArticles
        ? Math.round((sentimentCount.positive / totalArticles) * 100)
        : 0;

    const handleRefresh = () =>
        fetchNews(activePreset || searchInput || 'global', category);

    /* ------------------------------------------------------------------- */
    /*  Render                                                              */
    /* ------------------------------------------------------------------- */

    return (
        <div className="min-h-screen bg-background text-foreground pt-14">
            <main className={cn(PAGE_CONTENT_CLASS, 'p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-5')}>
                {/* ─── Header ──────────────────────────────────────────── */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                            <Newspaper className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h1 className="text-lg font-semibold tracking-tight">Market Intelligence</h1>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Real-time news with AI-powered sentiment analysis.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                            Updated {lastUpdated}
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleRefresh}
                            disabled={loading}
                            className="gap-1.5"
                        >
                            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* ─── Search + Category ───────────────────────────────── */}
                <Card className="bg-card/60 border-border/50">
                    <CardContent className="p-4 space-y-4">
                        <div className="flex items-center gap-3 flex-wrap">
                            {/* Category toggle */}
                            <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-muted/40 border border-border/40">
                                <button
                                    type="button"
                                    onClick={() => setCategory('market')}
                                    className={cn(
                                        'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                                        category === 'market'
                                            ? 'bg-primary/15 text-primary border border-primary/30'
                                            : 'text-muted-foreground hover:text-foreground border border-transparent',
                                    )}
                                >
                                    <Globe2 className="w-3.5 h-3.5" />
                                    Market
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setCategory('company')}
                                    className={cn(
                                        'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                                        category === 'company'
                                            ? 'bg-primary/15 text-primary border border-primary/30'
                                            : 'text-muted-foreground hover:text-foreground border border-transparent',
                                    )}
                                >
                                    <Building2 className="w-3.5 h-3.5" />
                                    Company
                                </button>
                            </div>

                            {/* Search */}
                            <div className="flex-1 flex items-center gap-2 min-w-[240px]">
                                <div className="relative flex-1">
                                    <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    <Input
                                        value={searchInput}
                                        onChange={(e) => setSearchInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder={
                                            category === 'company'
                                                ? 'Enter ticker (e.g. AAPL, TSLA, NVDA)'
                                                : 'Search market topic (e.g. AI stocks, oil prices)'
                                        }
                                        className="pl-9"
                                    />
                                </div>
                                <Button
                                    type="button"
                                    onClick={category === 'company' ? handleCompanySearch : handleMarketCustomSearch}
                                    disabled={!searchInput.trim() || loading}
                                    className="gap-1.5"
                                >
                                    {loading ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <ArrowRight className="w-3.5 h-3.5" />
                                    )}
                                    Search
                                </Button>
                            </div>
                        </div>

                        {/* Presets / popular tickers */}
                        {category === 'market' ? (
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-1">
                                    Sectors
                                </span>
                                {MARKET_PRESETS.map((preset) => (
                                    <button
                                        key={preset.key}
                                        type="button"
                                        onClick={() => handlePresetClick(preset.key, preset.label)}
                                        disabled={loading}
                                        className={cn(
                                            'px-2.5 py-1 rounded-md text-xs font-medium transition-colors border disabled:opacity-50',
                                            activePreset === preset.key
                                                ? 'bg-primary/15 text-primary border-primary/30'
                                                : 'bg-muted/40 text-muted-foreground border-border/40 hover:text-foreground hover:border-border',
                                        )}
                                    >
                                        {preset.label}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-1">
                                    Popular
                                </span>
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
                                        className="px-2.5 py-1 rounded-md text-xs font-medium font-mono bg-muted/40 text-muted-foreground border border-border/40 hover:text-foreground hover:border-border transition-colors disabled:opacity-50"
                                    >
                                        ${ticker}
                                    </button>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ─── Stat row ────────────────────────────────────────── */}
                {!loading && !error && news.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <StatTile label="Articles" value={totalArticles} icon={BarChart3} />
                        <StatTile
                            label="Bullish Share"
                            value={`${positiveRatio}%`}
                            icon={TrendingUp}
                            tone="profit"
                        />
                        <StatTile label="Tracked Tickers" value={tickerFrequency.length} icon={Hash} />
                        <StatTile label="News Sources" value={sourceBreakdown.length} icon={Globe2} />
                    </div>
                )}

                {/* ─── Filter row ──────────────────────────────────────── */}
                {!loading && !error && news.length > 0 && (
                    <Card className="bg-card/60 border-border/50">
                        <CardContent className="p-3 flex flex-col lg:flex-row lg:items-center gap-3">
                            <div className="relative flex-1">
                                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <Input
                                    value={filterQuery}
                                    onChange={(e) => setFilterQuery(e.target.value)}
                                    placeholder="Filter results by ticker, source, or keyword"
                                    className="pl-9"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <Filter className="w-4 h-4 text-muted-foreground" />
                                <Select
                                    value={sentimentFilter}
                                    onValueChange={(v) =>
                                        setSentimentFilter(v as 'all' | NewsArticle['sentiment'])
                                    }
                                >
                                    <SelectTrigger className="w-[140px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All sentiment</SelectItem>
                                        <SelectItem value="positive">Positive</SelectItem>
                                        <SelectItem value="negative">Negative</SelectItem>
                                        <SelectItem value="neutral">Neutral</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select value={tickerFilter} onValueChange={setTickerFilter}>
                                    <SelectTrigger className="w-[140px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All tickers</SelectItem>
                                        {tickerFrequency.slice(0, 12).map(({ ticker }) => (
                                            <SelectItem key={ticker} value={ticker}>
                                                ${ticker}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* ─── Content ─────────────────────────────────────────── */}
                {loading ? (
                    <Card className="bg-card/40 border-border/40 border-dashed">
                        <CardContent className="p-12 flex flex-col items-center justify-center gap-3 text-center">
                            <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                            </div>
                            <div>
                                <p className="text-sm text-foreground/80">Searching for latest news</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    Analyzing {activeLabel} with AI…
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                ) : error ? (
                    <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive p-4 text-sm">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">{error}</div>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleRefresh}
                            className="border-destructive/30 text-destructive hover:bg-destructive/10"
                        >
                            Try again
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        {/* Articles */}
                        <section className="lg:col-span-2 space-y-4">
                            <div className="flex items-center justify-between">
                                <h2 className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground font-semibold">
                                    Top Stories
                                </h2>
                                <span className="text-xs text-muted-foreground">
                                    {filteredNews.length} matching articles
                                </span>
                            </div>

                            {filteredNews.length === 0 ? (
                                <Card className="bg-card/40 border-border/40 border-dashed">
                                    <CardContent className="p-10 text-center text-sm text-muted-foreground">
                                        No articles match your current filters.
                                    </CardContent>
                                </Card>
                            ) : (
                                filteredNews.map((article) => (
                                    <Card
                                        key={article.id}
                                        className="bg-card/60 border-border/50 hover:border-border transition-colors group"
                                    >
                                        <CardContent className="p-5">
                                            <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold">
                                                        {article.source}
                                                    </span>
                                                    <Badge
                                                        variant="outline"
                                                        className={cn(
                                                            'text-[9px] uppercase font-bold tracking-wider',
                                                            sentimentBadgeClass[article.sentiment],
                                                        )}
                                                    >
                                                        {article.sentiment}
                                                    </Badge>
                                                </div>
                                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                                    <Clock3 className="w-3.5 h-3.5" />
                                                    <span>{formatPublishedAt(article.published_at)}</span>
                                                </div>
                                            </div>

                                            <h3 className="text-base font-semibold leading-tight mb-2 group-hover:text-primary transition-colors">
                                                {article.headline}
                                            </h3>
                                            <p className="text-sm text-muted-foreground leading-relaxed mb-4 line-clamp-3">
                                                {article.summary}
                                            </p>

                                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {article.tickers.map((ticker) => (
                                                        <button
                                                            type="button"
                                                            key={`${article.id}-${ticker}`}
                                                            onClick={() => setTickerFilter(ticker)}
                                                            className="px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors"
                                                        >
                                                            ${ticker}
                                                        </button>
                                                    ))}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <AskAi
                                                        target={{
                                                            type: 'symbol',
                                                            id: article.tickers[0] ?? article.id,
                                                            label: article.tickers[0] ?? article.headline.slice(0, 40),
                                                        }}
                                                        prompt={`Analyze this news for me:\n\n**${article.headline}**\n\n${article.summary}\n\nWhat are the implications?`}
                                                        variant="pill"
                                                    >
                                                        Ask AI
                                                    </AskAi>
                                                    <a
                                                        href={article.url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium"
                                                    >
                                                        Open story
                                                        <ChevronRight className="w-4 h-4" />
                                                    </a>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </section>

                        {/* Sidebar */}
                        <aside className="space-y-4">
                            {analysis && (
                                <Card className="bg-primary/[0.04] border-primary/20">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                            <Brain className="w-4 h-4 text-primary" />
                                            AI Analysis
                                            <Badge
                                                variant="outline"
                                                className={cn(
                                                    'ml-auto text-[9px] uppercase font-bold tracking-wider',
                                                    sentimentBadgeClass[
                                                        (analysis.overall_sentiment as NewsArticle['sentiment']) ??
                                                            'neutral'
                                                    ],
                                                )}
                                            >
                                                {analysis.overall_sentiment}
                                            </Badge>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <p className="text-sm text-muted-foreground leading-relaxed">
                                            {analysis.summary}
                                        </p>

                                        {analysis.key_takeaways.length > 0 && (
                                            <div className="space-y-2">
                                                <h4 className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                                                    Key Takeaways
                                                </h4>
                                                {analysis.key_takeaways.map((point) => (
                                                    <div key={point} className="flex items-start gap-2">
                                                        <Target className="w-3.5 h-3.5 text-primary/60 mt-0.5 shrink-0" />
                                                        <span className="text-xs text-muted-foreground leading-relaxed">
                                                            {point}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {analysis.market_impact && (
                                            <div className="pt-3 border-t border-border/40">
                                                <h4 className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 font-semibold">
                                                    Market Impact
                                                </h4>
                                                <p className="text-xs text-muted-foreground leading-relaxed">
                                                    {analysis.market_impact}
                                                </p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            {/* Sentiment Pulse */}
                            <Card className="bg-card/60 border-border/50">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-primary" />
                                        Sentiment Pulse
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                    {(['positive', 'neutral', 'negative'] as NewsArticle['sentiment'][]).map(
                                        (sentiment) => {
                                            const total = totalArticles || 1;
                                            const pct = Math.round(
                                                (sentimentCount[sentiment] / total) * 100,
                                            );
                                            return (
                                                <div key={sentiment}>
                                                    <div className="flex items-center justify-between text-xs mb-1">
                                                        <span className="capitalize text-foreground/80">
                                                            {sentiment}
                                                        </span>
                                                        <span className="tabular-nums text-muted-foreground">
                                                            {sentimentCount[sentiment]} ({pct}%)
                                                        </span>
                                                    </div>
                                                    <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                                                        <div
                                                            className={cn(
                                                                'h-full transition-all duration-500',
                                                                sentimentBarClass[sentiment],
                                                            )}
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        },
                                    )}
                                </CardContent>
                            </Card>

                            {/* Most Mentioned Tickers */}
                            {tickerFrequency.length > 0 && (
                                <Card className="bg-card/60 border-border/50">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                            <Hash className="w-4 h-4 text-primary" />
                                            Top Mentioned
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-1.5">
                                        {tickerFrequency.slice(0, 6).map((item) => (
                                            <button
                                                type="button"
                                                key={item.ticker}
                                                onClick={() => setTickerFilter(item.ticker)}
                                                className="w-full flex items-center justify-between rounded-md border border-border/40 bg-muted/30 px-3 py-1.5 text-left hover:bg-muted/60 hover:border-border transition-colors"
                                            >
                                                <span className="text-sm font-mono font-medium">
                                                    ${item.ticker}
                                                </span>
                                                <span className="text-xs text-muted-foreground tabular-nums">
                                                    {item.mentions} mentions
                                                </span>
                                            </button>
                                        ))}
                                    </CardContent>
                                </Card>
                            )}

                            {/* Source Coverage */}
                            {sourceBreakdown.length > 0 && (
                                <Card className="bg-card/60 border-border/50">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                            <Globe2 className="w-4 h-4 text-primary" />
                                            Source Coverage
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-2.5">
                                        {sourceBreakdown.map((item) => {
                                            const pct = totalArticles
                                                ? Math.round((item.count / totalArticles) * 100)
                                                : 0;
                                            return (
                                                <div key={item.source}>
                                                    <div className="flex items-center justify-between text-xs mb-1">
                                                        <span className="truncate max-w-[70%] text-foreground/80">
                                                            {item.source}
                                                        </span>
                                                        <span className="tabular-nums text-muted-foreground">
                                                            {item.count}
                                                        </span>
                                                    </div>
                                                    <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
                                                        <div
                                                            className="h-full bg-primary/70 transition-all duration-500"
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </CardContent>
                                </Card>
                            )}
                        </aside>
                    </div>
                )}
            </main>
        </div>
    );
}

/* -------------------------------------------------------------------------- */
/*  Stat tile — token-driven                                                  */
/* -------------------------------------------------------------------------- */

interface StatTileProps {
    label: string;
    value: number | string;
    icon: React.ComponentType<{ className?: string }>;
    tone?: 'default' | 'profit' | 'loss';
}

const StatTile = ({ label, value, icon: Icon, tone = 'default' }: StatTileProps) => (
    <div className="rounded-lg border border-border/50 bg-card/60 p-3.5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            {label}
        </div>
        <div className="mt-1.5 flex items-end justify-between">
            <span
                className={cn(
                    'text-xl font-semibold tabular-nums',
                    tone === 'profit' && 'text-profit',
                    tone === 'loss' && 'text-loss',
                )}
            >
                {value}
            </span>
            <Icon
                className={cn(
                    'w-4 h-4',
                    tone === 'profit' ? 'text-profit/70' : tone === 'loss' ? 'text-loss/70' : 'text-muted-foreground/70',
                )}
            />
        </div>
    </div>
);
