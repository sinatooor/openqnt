import { useState, useEffect } from 'react';
import { Newspaper, ChevronRight, TrendingUp, TrendingDown, Clock, Search, Filter } from 'lucide-react';
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

    useEffect(() => {
        fetchNews();
    }, []);

    const fetchNews = async () => {
        try {
            setLoading(true);
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

    return (
        <div className={PAGE_CONTENT_CLASS}>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Newspaper className="w-6 h-6 text-primary" />
                        Market News
                    </h1>
                    <p className="text-white/50 text-sm mt-1">Real-time market intelligence and correlated assets.</p>
                </div>
                
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="w-4 h-4 text-white/40 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input 
                            type="text" 
                            placeholder="Search ticker or keyword" 
                            className="bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-primary/50"
                        />
                    </div>
                    <button className="p-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors">
                        <Filter className="w-4 h-4 text-white/70" />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : error ? (
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400">
                    {error}
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-4">
                        <h2 className="text-lg font-semibold text-white/90 mb-4">Latest Top Stories</h2>
                        {news.map(article => (
                            <div key={article.id} className="bg-white/5 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-all cursor-pointer group">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        {article.tickers.map(ticker => (
                                            <span key={ticker} className="px-2 py-0.5 bg-primary/20 text-primary text-xs rounded font-medium">
                                                ${ticker}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs text-white/40">
                                        <Clock className="w-3 h-3" />
                                        <span>{new Date(article.published_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                    </div>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-primary transition-colors">
                                    {article.headline}
                                </h3>
                                <p className="text-white/60 text-sm mb-4 leading-relaxed line-clamp-2">
                                    {article.summary}
                                </p>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-white/40 font-medium">{article.source}</span>
                                    <div className="flex items-center gap-2">
                                        {article.sentiment === 'positive' ? (
                                            <span className="flex items-center gap-1 text-green-400 bg-green-400/10 px-2 py-1 rounded">
                                                <TrendingUp className="w-3 h-3" /> Positive
                                            </span>
                                        ) : article.sentiment === 'negative' ? (
                                            <span className="flex items-center gap-1 text-red-400 bg-red-400/10 px-2 py-1 rounded">
                                                <TrendingDown className="w-3 h-3" /> Negative
                                            </span>
                                        ) : null}
                                        <a href={article.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline ml-2">
                                            Read More <ChevronRight className="w-3 h-3" />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="space-y-6">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                            <h3 className="text-sm font-semibold text-white/80 mb-4 uppercase tracking-wider">Top Movers</h3>
                            <div className="space-y-3">
                                {[
                                    { ticker: 'NVDA', change: '+4.2%', price: '135.24', up: true },
                                    { ticker: 'TSLA', change: '-1.8%', price: '185.10', up: false },
                                    { ticker: 'AAPL', change: '+2.1%', price: '172.90', up: true },
                                    { ticker: 'META', change: '-0.5%', price: '168.45', up: false },
                                ].map(stock => (
                                    <div key={stock.ticker} className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg transition-colors cursor-pointer">
                                        <div className="font-bold text-white">{stock.ticker}</div>
                                        <div className="text-right">
                                            <div className="text-sm text-white/90">${stock.price}</div>
                                            <div className={`text-xs flex items-center justify-end ${stock.up ? 'text-green-400' : 'text-red-400'}`}>
                                                {stock.up ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                                                {stock.change}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                            <h3 className="text-sm font-semibold text-white/80 mb-4 uppercase tracking-wider">Market Sentiment</h3>
                            <div className="flex flex-col items-center justify-center p-4">
                                <div className="text-4xl font-bold text-green-400 mb-2">68</div>
                                <div className="text-sm text-white/50 mb-4">Greed</div>
                                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                                    <div className="h-full bg-gradient-to-r from-red-500 via-yellow-500 to-green-500" style={{ width: '68%' }} />
                                </div>
                                <div className="flex justify-between w-full text-[10px] text-white/30 mt-2 font-medium">
                                    <span>Extreme Fear</span>
                                    <span>Extreme Greed</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
