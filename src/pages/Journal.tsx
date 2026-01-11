
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw } from "lucide-react";

interface Trade {
    id: number;
    symbol: string;
    direction: string;
    entry_time: string;
    entry_price: number;
    size: number;
    exit_time: string | null;
    exit_price: number | null;
    pnl: number | null;
    pnl_percent: number | null;
    status: string;
    broker_ref: string | null;
}

const Journal = () => {
    const navigate = useNavigate();
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTrades = async () => {
        setLoading(true);
        try {
            const response = await fetch("http://127.0.0.1:8000/api/trades/"); // Hardcoded backend URL for now
            if (response.ok) {
                const data = await response.json();
                setTrades(data);
            } else {
                console.error("Failed to fetch trades");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTrades();
    }, []);

    return (
        <div className="min-h-screen bg-background text-foreground p-8">
            <div className="max-w-7xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => navigate("/")}>
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Workspace
                        </Button>
                        <h1 className="text-3xl font-bold">Trade Journal</h1>
                    </div>
                    <Button variant="outline" onClick={fetchTrades} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </Button>
                </div>

                <div className="bg-card rounded-lg border border-border overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                            <tr className="border-b border-border text-left">
                                <th className="p-4 font-medium text-muted-foreground">ID</th>
                                <th className="p-4 font-medium text-muted-foreground">Time</th>
                                <th className="p-4 font-medium text-muted-foreground">Symbol</th>
                                <th className="p-4 font-medium text-muted-foreground">Type</th>
                                <th className="p-4 font-medium text-muted-foreground">Size</th>
                                <th className="p-4 font-medium text-muted-foreground">Price</th>
                                <th className="p-4 font-medium text-muted-foreground">PnL</th>
                                <th className="p-4 font-medium text-muted-foreground">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trades.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-muted-foreground">
                                        No trades recorded yet. Run a strategy to generate data.
                                    </td>
                                </tr>
                            ) : (
                                trades.map((trade) => (
                                    <tr key={trade.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                                        <td className="p-4 font-mono text-xs text-muted-foreground">#{trade.id}</td>
                                        <td className="p-4">{new Date(trade.entry_time).toLocaleString()}</td>
                                        <td className="p-4 font-semibold">{trade.symbol}</td>
                                        <td className={`p-4 font-bold ${trade.direction === 'BUY' ? 'text-green-500' : 'text-red-500'}`}>
                                            {trade.direction}
                                        </td>
                                        <td className="p-4">{trade.size}</td>
                                        <td className="p-4 font-mono">{trade.entry_price.toFixed(5)}</td>
                                        <td className={`p-4 font-mono ${trade.pnl && trade.pnl > 0 ? 'text-green-500' : trade.pnl && trade.pnl < 0 ? 'text-red-500' : ''}`}>
                                            {trade.pnl ? trade.pnl.toFixed(2) : '-'}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded-full text-xs border ${trade.status === 'OPEN'
                                                    ? 'border-blue-500/30 bg-blue-500/10 text-blue-500'
                                                    : 'border-muted bg-muted/30 text-muted-foreground'
                                                }`}>
                                                {trade.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Journal;
