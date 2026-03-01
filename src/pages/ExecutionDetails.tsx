
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { ArrowLeft, Clock, Activity, BarChart2, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchExecution, fetchTrades } from "@/services/trades";
import { TradeFeed, TradeEvent } from "@/components/TradeFeed";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ConfigProvider, theme as antTheme } from 'antd';
import { motion } from 'framer-motion';
import { PAGE_CONTENT_CLASS } from '@/components/PageHeader';

const ExecutionDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const executionId = parseInt(id || "0");
  const [isLive, setIsLive] = useState(false);
  const [liveTrades, setLiveTrades] = useState<TradeEvent[]>([]);

  const { data: execution, isLoading: loadingExecution } = useQuery({
    queryKey: ['execution', executionId],
    queryFn: () => fetchExecution(executionId),
    enabled: !!executionId,
  });

  const { data: trades = [], isLoading: loadingTrades } = useQuery({
    queryKey: ['trades', 'execution', executionId],
    queryFn: () => fetchTrades({ execution_id: executionId }),
    enabled: !!executionId,
    refetchInterval: isLive ? 5000 : false, // Poll every 5s when live
  });

  // WebSocket for real-time updates
  useEffect(() => {
    if (!executionId || execution?.status !== 'RUNNING') return;

    const wsUrl = `ws://localhost:8000/ws/trades/${executionId}`;
    let ws: WebSocket | null = null;

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('[WS] Connected to trade feed');
        setIsLive(true);
      };

      ws.onmessage = (event) => {
        try {
          const trade = JSON.parse(event.data);
          setLiveTrades(prev => [...prev, trade]);
        } catch (e) {
          console.warn('[WS] Failed to parse trade:', e);
        }
      };

      ws.onclose = () => {
        console.log('[WS] Disconnected');
        setIsLive(false);
      };

      ws.onerror = () => {
        setIsLive(false);
      };
    } catch (e) {
      console.warn('[WS] Failed to connect:', e);
    }

    return () => {
      ws?.close();
    };
  }, [executionId, execution?.status]);

  // Combine fetched trades with live trades
  const allTrades = [...trades, ...liveTrades];

  if (!executionId) return <div>Invalid ID</div>;

  return (
    <ConfigProvider
      theme={{
        algorithm: antTheme.darkAlgorithm,
        token: {
          colorPrimary: '#3b82f6',
          colorBgContainer: 'transparent',
          colorText: '#e2e8f0',
          colorTextSecondary: '#94a3b8',
          borderRadius: 8,
          fontSize: 13,
        },
      }}
    >
      <div className="min-h-screen bg-background text-foreground flex flex-col pt-14">
        <main className={`flex-1 p-6 ${PAGE_CONTENT_CLASS} space-y-6`}>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              <h1 className="text-white font-medium text-sm tracking-tight">Execution Details</h1>
              <div className="h-4 w-px bg-white/10" />
              <span className="text-white/40 text-xs flex items-center gap-2">
                Run #{executionId}
                {isLive && (
                  <Badge variant="default" className="bg-green-600/20 text-green-400 border border-green-500/30 animate-pulse text-[10px] px-2 py-0">
                    <Radio className="w-3 h-3 mr-1" />
                    LIVE
                  </Badge>
                )}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate("/executions")} className="text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>

          {loadingExecution ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              Loading execution details...
            </div>
          ) : execution ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid gap-6 md:grid-cols-2"
            >
              <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading-lg rounded-xl">
                <CardHeader className="border-b border-white/5 pb-4">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-primary" />
                      Strategy Info
                    </span>
                    <Badge variant={execution.status === 'RUNNING' ? 'default' : 'secondary'} className={execution.status === 'RUNNING' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : ''}>
                      {execution.status}
                    </Badge>
                  </CardTitle>
                  <CardDescription>Configuration and Status</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <div className="flex justify-between items-center pb-2">
                    <span className="text-muted-foreground text-sm">Name</span>
                    <span className="font-medium text-sm">{execution.strategy_name}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2">
                    <span className="text-muted-foreground text-sm">Symbol</span>
                    <span className="font-mono text-sm">{execution.symbol}</span>
                  </div>
                  <div className="flex justify-between items-center pb-2">
                    <span className="text-muted-foreground text-sm flex items-center"><Clock className="w-3.5 h-3.5 mr-1" /> Start</span>
                    <span className="text-sm">{new Date(execution.start_time).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground text-sm">End</span>
                    <span className="text-sm">{execution.end_time ? new Date(execution.end_time).toLocaleString() : 'Running...'}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading-lg rounded-xl">
                <CardHeader className="border-b border-white/5 pb-4">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <BarChart2 className="w-4 h-4 text-green-400" />
                    Performance Summary
                  </CardTitle>
                  <CardDescription>Session Statistics</CardDescription>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-black/20 border border-white/5 rounded-xl">
                      <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Total Trades</p>
                      <p className="text-2xl font-bold font-mono text-foreground">{allTrades.length}</p>
                    </div>
                    <div className="text-center p-4 bg-black/20 border border-white/5 rounded-xl">
                      <p className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Net PnL</p>
                      <p className={`text-2xl font-bold font-mono ${allTrades.reduce((acc, t) => acc + (t.pnl || 0), 0) >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}>
                        ${allTrades.reduce((acc, t) => acc + (t.pnl || 0), 0).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ) : (
            <div className="text-muted-foreground">Execution not found.</div>
          )}

          {/* Live Trade Feed */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading-lg rounded-xl">
              <CardHeader className="border-b border-white/5 pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  Live Trade Feed
                  {isLive && <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10">Connected</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <TradeFeed trades={allTrades as TradeEvent[]} isLive={isLive} />
              </CardContent>
            </Card>
          </motion.div>

          {/* Trade Log Table */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading-lg rounded-xl">
              <CardHeader className="border-b border-white/5 pb-4">
                <CardTitle className="text-base">Trade Log</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader className="bg-black/20">
                    <TableRow className="border-white/5 hover:bg-transparent">
                      <TableHead className="text-xs text-muted-foreground uppercase">Time</TableHead>
                      <TableHead className="text-xs text-muted-foreground uppercase">Direction</TableHead>
                      <TableHead className="text-right text-xs text-muted-foreground uppercase">Price</TableHead>
                      <TableHead className="text-right text-xs text-muted-foreground uppercase">Size</TableHead>
                      <TableHead className="text-right text-xs text-muted-foreground uppercase">PnL</TableHead>
                      <TableHead className="text-xs text-muted-foreground uppercase">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allTrades.length === 0 ? (
                      <TableRow className="border-white/5 hover:bg-white/[0.02]">
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          No trades recorded
                        </TableCell>
                      </TableRow>
                    ) : (
                      allTrades.map((trade) => (
                        <TableRow key={trade.id} className="border-white/5 hover:bg-white/[0.02]">
                          <TableCell className="font-mono text-xs text-muted-foreground">{new Date(trade.entry_time).toLocaleTimeString()}</TableCell>
                          <TableCell className={trade.direction === 'BUY' ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>{trade.direction}</TableCell>
                          <TableCell className="text-right font-mono text-xs">{trade.entry_price.toFixed(5)}</TableCell>
                          <TableCell className="text-right text-sm">{trade.size}</TableCell>
                          <TableCell className={`text-right font-mono text-xs font-medium ${trade.pnl && trade.pnl > 0 ? 'text-green-400' : 'text-red-400'}`}>
                            {trade.pnl?.toFixed(2) || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] ${trade.status === 'FILLED' ? 'border-green-500/30 text-green-400 bg-green-500/10' :
                                'border-white/10 text-muted-foreground bg-white/5'
                              }`}>
                              {trade.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </motion.div>
        </main>
      </div>
    </ConfigProvider>
  );
};

export default ExecutionDetails;