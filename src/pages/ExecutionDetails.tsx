
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Clock, Activity, BarChart2, Radio, Layers, CheckCircle2, XCircle, SkipForward, ArrowRightLeft, ChevronDown, ChevronRight } from "lucide-react";
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
import { api } from '@/services/api';
import { strategyWS } from '@/services/websocket';

interface NodeLog {
  id: string;
  nodeId: string;
  nodeType: string;
  status: 'success' | 'error' | 'skipped' | 'delegated';
  inputData: Record<string, any>;
  outputData: Record<string, any>;
  errorMessage?: string;
  durationMs: number;
  executionOrder: number;
}

const NodeStatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'success': return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    case 'error': return <XCircle className="w-4 h-4 text-red-400" />;
    case 'skipped': return <SkipForward className="w-4 h-4 text-slate-400" />;
    case 'delegated': return <ArrowRightLeft className="w-4 h-4 text-blue-400" />;
    default: return <Activity className="w-4 h-4 text-muted-foreground" />;
  }
};

const statusBadgeStyle: Record<string, { color: string; bg: string }> = {
  success: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
  error: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
  running: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
  skipped: { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  delegated: { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)' },
  pending_approval: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
};

const ExecutionDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const executionId = id || '';
  const [isLive, setIsLive] = useState(false);
  const [liveTrades, setLiveTrades] = useState<TradeEvent[]>([]);
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const [liveNodeUpdates, setLiveNodeUpdates] = useState<Map<string, any>>(new Map());

  // Fetch execution run with node logs from orchestrator
  const { data: executionData, isLoading: loadingExecution, refetch } = useQuery({
    queryKey: ['execution-details', executionId],
    queryFn: () => api.getExecution(executionId),
    enabled: !!executionId,
  });

  const execution = executionData?.run;
  const nodeLogs: NodeLog[] = execution?.nodeLogs ?? [];

  // Fetch trades (legacy support)
  const numericId = parseInt(executionId || "0");
  const { data: trades = [], isLoading: loadingTrades } = useQuery({
    queryKey: ['trades', 'execution', executionId],
    queryFn: () => fetchTrades({ execution_id: numericId }),
    enabled: !!numericId,
    refetchInterval: isLive ? 5000 : false,
  });

  // Subscribe to real-time WebSocket updates from the orchestrator
  useEffect(() => {
    if (!executionId || execution?.status !== 'running') return;

    setIsLive(true);

    // Listen for per-node updates
    const unsubNode = strategyWS.on('execution:node-update', (data: any) => {
      setLiveNodeUpdates(prev => {
        const next = new Map(prev);
        next.set(data.nodeId, data);
        return next;
      });
    });

    // Listen for execution completion
    const unsubComplete = strategyWS.on('execution:completed', (_data: any) => {
      setIsLive(false);
      refetch(); // Reload full data from API
    });

    // Connect if not already
    if (!strategyWS.isConnected) {
      strategyWS.connect();
    }

    return () => {
      unsubNode();
      unsubComplete();
    };
  }, [executionId, execution?.status, refetch]);

  const toggleNodeExpand = useCallback((nodeId: string) => {
    setExpandedNode(prev => prev === nodeId ? null : nodeId);
  }, []);

  // Combine fetched trades with live trades
  const allTrades = [...trades, ...liveTrades];

  if (!executionId) return <div>Invalid ID</div>;

  const execStatus = execution?.status ?? 'unknown';
  const sStyle = statusBadgeStyle[execStatus] ?? statusBadgeStyle.skipped;

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
                Run #{executionId.slice(0, 8)}
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
            <>
              {/* Summary Cards */}
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
                        Execution Info
                      </span>
                      <Badge
                        className="text-[11px] font-medium tracking-wide uppercase px-2 py-0.5"
                        style={{ backgroundColor: sStyle.bg, color: sStyle.color, borderColor: 'transparent' }}
                      >
                        {execStatus}
                      </Badge>
                    </CardTitle>
                    <CardDescription>Run details and configuration</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm">Strategy</span>
                      <span className="font-medium text-sm">{execution.strategy?.name ?? 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm">Trigger</span>
                      <span className="font-mono text-sm">{execution.triggerType}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm flex items-center"><Clock className="w-3.5 h-3.5 mr-1" /> Started</span>
                      <span className="text-sm">{new Date(execution.startedAt).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm">Finished</span>
                      <span className="text-sm">{execution.finishedAt ? new Date(execution.finishedAt).toLocaleString() : 'Running...'}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-sm">Duration</span>
                      <span className="font-mono text-sm">{execution.durationMs ? `${execution.durationMs}ms` : '—'}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading-lg rounded-xl">
                  <CardHeader className="border-b border-white/5 pb-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BarChart2 className="w-4 h-4 text-green-400" />
                      Node Summary
                    </CardTitle>
                    <CardDescription>Execution breakdown</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="text-center p-3 bg-black/20 border border-white/5 rounded-xl">
                        <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Executed</p>
                        <p className="text-2xl font-bold font-mono text-green-400">{execution.nodesExecuted ?? 0}</p>
                      </div>
                      <div className="text-center p-3 bg-black/20 border border-white/5 rounded-xl">
                        <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Errored</p>
                        <p className="text-2xl font-bold font-mono text-red-400">{execution.nodesErrored ?? 0}</p>
                      </div>
                      <div className="text-center p-3 bg-black/20 border border-white/5 rounded-xl">
                        <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Skipped</p>
                        <p className="text-2xl font-bold font-mono text-slate-400">{execution.nodesSkipped ?? 0}</p>
                      </div>
                      <div className="text-center p-3 bg-black/20 border border-white/5 rounded-xl">
                        <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Python Calls</p>
                        <p className="text-2xl font-bold font-mono text-blue-400">{execution.pythonDelegations ?? 0}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Node Execution Log */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading-lg rounded-xl">
                  <CardHeader className="border-b border-white/5 pb-4">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Layers className="w-4 h-4 text-primary" />
                      Node Execution Log
                      <span className="text-xs text-muted-foreground font-normal ml-2">
                        {nodeLogs.length} nodes
                      </span>
                    </CardTitle>
                    <CardDescription>Per-node execution details — click a row to inspect data</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {nodeLogs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Layers className="w-8 h-8 mb-2 opacity-40" />
                        <p className="text-sm">No node logs recorded</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {/* Table Header */}
                        <div className="hidden sm:flex items-center px-6 py-3 bg-black/20 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          <div className="w-8"></div>
                          <div className="flex-1">Node</div>
                          <div className="w-24">Type</div>
                          <div className="w-24">Status</div>
                          <div className="w-24 text-right">Duration</div>
                          <div className="w-8"></div>
                        </div>

                        {nodeLogs.map((log, i) => {
                          const nStyle = statusBadgeStyle[log.status] ?? statusBadgeStyle.skipped;
                          const isExpanded = expandedNode === log.nodeId;
                          // Merge live updates if available
                          const liveUpdate = liveNodeUpdates.get(log.nodeId);
                          const displayStatus = liveUpdate?.status ?? log.status;

                          return (
                            <div key={log.nodeId + '-' + i}>
                              <div
                                onClick={() => toggleNodeExpand(log.nodeId)}
                                className="flex items-center px-6 py-3 hover:bg-white/[0.03] transition-colors cursor-pointer group"
                              >
                                <div className="w-8 text-xs text-muted-foreground font-mono">
                                  {log.executionOrder + 1}
                                </div>
                                <div className="flex-1 flex items-center gap-2">
                                  <NodeStatusIcon status={displayStatus} />
                                  <span className="text-sm font-medium text-foreground">{log.nodeId}</span>
                                </div>
                                <div className="w-24">
                                  <span className="text-xs text-muted-foreground bg-white/5 px-2 py-0.5 rounded">
                                    {log.nodeType}
                                  </span>
                                </div>
                                <div className="w-24">
                                  <Badge
                                    className="text-[10px] font-medium tracking-wide uppercase px-2 py-0"
                                    style={{ backgroundColor: nStyle.bg, color: nStyle.color, borderColor: 'transparent' }}
                                  >
                                    {displayStatus}
                                  </Badge>
                                </div>
                                <div className="w-24 text-right text-xs font-mono text-muted-foreground">
                                  {log.durationMs}ms
                                </div>
                                <div className="w-8 flex justify-end">
                                  {isExpanded
                                    ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                    : <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                                  }
                                </div>
                              </div>

                              {/* Expanded detail panel */}
                              {isExpanded && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  className="px-6 pb-4 bg-black/20 border-t border-white/5"
                                >
                                  <div className="grid md:grid-cols-2 gap-4 pt-3">
                                    {log.errorMessage && (
                                      <div className="md:col-span-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                                        <p className="text-xs text-red-400 font-medium mb-1">Error</p>
                                        <p className="text-xs text-red-300 font-mono">{log.errorMessage}</p>
                                      </div>
                                    )}
                                    <div>
                                      <p className="text-xs text-muted-foreground font-medium mb-2">Output Data</p>
                                      <pre className="text-xs font-mono text-foreground/80 bg-black/30 rounded-lg p-3 overflow-auto max-h-48 border border-white/5">
                                        {JSON.stringify(log.outputData, null, 2)}
                                      </pre>
                                    </div>
                                    <div>
                                      <p className="text-xs text-muted-foreground font-medium mb-2">Input Connections</p>
                                      <pre className="text-xs font-mono text-foreground/80 bg-black/30 rounded-lg p-3 overflow-auto max-h-48 border border-white/5">
                                        {JSON.stringify(log.inputData, null, 2)}
                                      </pre>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* Live Trade Feed */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
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
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
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
            </>
          ) : (
            <div className="text-muted-foreground">Execution not found.</div>
          )}
        </main>
      </div>
    </ConfigProvider>
  );
};

export default ExecutionDetails;
