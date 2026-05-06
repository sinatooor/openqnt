/**
 * Portfolio Page - Full portfolio management with analytics
 *
 * Features:
 * - Add holdings (stocks, crypto, gold, etc.) by quantity or percentage
 * - Live price tracking with dynamic allocation updates
 * - Portfolio value over time chart
 * - Allocation pie chart, asset breakdown, per-holding P&L
 * - Day change, total P&L, and performance metrics
 */

import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { usePageContext, AskAi } from '@/features/ai-chat';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, BarChart, Bar, Legend,
} from 'recharts';

// shadcn
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// MUI
import CircularProgress from '@mui/material/CircularProgress';

// Ant Design
import { ConfigProvider, theme as antTheme, Empty } from 'antd';

// Icons
import {
  Briefcase,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart as PieChartIcon,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Download,
  Upload,
  Edit3,
  Eye,
  Coins,
  Bitcoin,
  Gem,
  Landmark,
  Globe,
  Layers,
  Banknote,
  Wallet,
} from 'lucide-react';
import { PAGE_CONTENT_CLASS } from '@/components/PageHeader';

// Stores
import { usePortfolioStore, type AssetType, type HoldingInputMode, type PortfolioHolding, type CostBasisMethod, ASSET_COLORS, CHART_COLORS } from '@/stores/portfolioStore';
import { useAppModeStore } from '@/stores/appModeStore';
import { useAccountStore } from '@/stores/accountStore';
import { api } from '@/services/api';

// Portfolio sub-features
import { TradeDialog } from '@/features/portfolio/TradeDialog';
import { ImportDialog } from '@/features/portfolio/ImportDialog';
import { LotsTable } from '@/features/portfolio/LotsTable';
import { RiskPanel } from '@/features/portfolio/RiskPanel';
import { StressPanel } from '@/features/portfolio/StressPanel';
import { MacroPanel } from '@/features/portfolio/MacroPanel';
import { RebalancePanel } from '@/features/portfolio/RebalancePanel';
import { AuditLogPanel } from '@/features/portfolio/AuditLogPanel';
import { EarningsCalendar } from '@/features/portfolio/EarningsCalendar';
import { downloadCsv, holdingsSnapshotCsv, realizedGainLossCsv } from '@/features/portfolio/csv';

// ─── Asset Type Icons ───────────────────────────────────────

const ASSET_TYPE_ICONS: Record<AssetType, React.ReactNode> = {
  stock: <Landmark className="w-4 h-4" />,
  crypto: <Bitcoin className="w-4 h-4" />,
  gold: <Coins className="w-4 h-4" />,
  commodity: <Gem className="w-4 h-4" />,
  forex: <Globe className="w-4 h-4" />,
  etf: <Layers className="w-4 h-4" />,
  bond: <Banknote className="w-4 h-4" />,
  cash: <Wallet className="w-4 h-4" />,
};

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  stock: 'Stock',
  crypto: 'Cryptocurrency',
  gold: 'Gold',
  commodity: 'Commodity',
  forex: 'Forex',
  etf: 'ETF',
  bond: 'Bond',
  cash: 'Cash',
};

// ─── Format Helpers ─────────────────────────────────────────

const formatCurrency = (value: number, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatPercent = (value: number) => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
};

const formatNumber = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(value);
};

// ─── Demo Holdings ──────────────────────────────────────────

const DEMO_HOLDINGS: Omit<PortfolioHolding, 'id' | 'currentPrice' | 'previousClose' | 'lastUpdated' | 'addedAt'>[] = [
  { symbol: 'AAPL', name: 'Apple Inc.', assetType: 'stock', inputMode: 'quantity', quantity: 50, targetPercentage: 0, avgCost: 178.50, currency: 'USD' },
  { symbol: 'BTC', name: 'Bitcoin', assetType: 'crypto', inputMode: 'quantity', quantity: 0.5, targetPercentage: 0, avgCost: 42000, currency: 'USD' },
  { symbol: 'XAU', name: 'Gold (oz)', assetType: 'gold', inputMode: 'quantity', quantity: 5, targetPercentage: 0, avgCost: 2050, currency: 'USD' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', assetType: 'stock', inputMode: 'quantity', quantity: 30, targetPercentage: 0, avgCost: 380.00, currency: 'USD' },
  { symbol: 'ETH', name: 'Ethereum', assetType: 'crypto', inputMode: 'quantity', quantity: 5, targetPercentage: 0, avgCost: 2200, currency: 'USD' },
  { symbol: 'VOO', name: 'Vanguard S&P 500 ETF', assetType: 'etf', inputMode: 'quantity', quantity: 20, targetPercentage: 0, avgCost: 425.00, currency: 'USD' },
];

// ─── Generate Demo History ──────────────────────────────────

function generateDemoHistory() {
  const now = Date.now();
  const dayMs = 86400000;
  const baseValue = 50000;
  const data = [];
  for (let i = 90; i >= 0; i--) {
    const noise = Math.sin(i * 0.15) * 3000 + Math.random() * 2000 - 1000;
    const trend = (90 - i) * 40;
    data.push({
      timestamp: now - i * dayMs,
      totalValue: baseValue + trend + noise,
      date: new Date(now - i * dayMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    });
  }
  return data;
}

// ─── Generate Per-Asset History ─────────────────────────────

function generateAssetHistory(symbol: string, baseValue: number) {
  const now = Date.now();
  const dayMs = 86400000;
  const data = [];
  for (let i = 30; i >= 0; i--) {
    const noise = Math.sin(i * 0.2 + symbol.charCodeAt(0)) * baseValue * 0.05 + Math.random() * baseValue * 0.03;
    const trend = (30 - i) * baseValue * 0.003;
    data.push({
      date: new Date(now - i * dayMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: baseValue + trend + noise,
    });
  }
  return data;
}

// =============================================================================
// MAIN PORTFOLIO PAGE
// =============================================================================

const Portfolio = () => {
  const store = usePortfolioStore();
  const { mode } = useAppModeStore();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [tradeDialog, setTradeDialog] = useState<{ holdingId: string; side: 'buy' | 'sell' } | null>(null);
  const [expandedLots, setExpandedLots] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loadingPrices, setLoadingPrices] = useState(false);

  const toggleLots = useCallback((id: string) => {
    setExpandedLots((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const tradeHolding = useMemo(
    () => (tradeDialog ? store.holdings.find((h) => h.id === tradeDialog.holdingId) : null),
    [tradeDialog, store.holdings]
  );

  const handleExportTaxCsv = useCallback(() => {
    if (store.realizedSales.length === 0) {
      toast.info('No realized sales yet. Sell from a holding to record realized P&L.');
      return;
    }
    const csv = realizedGainLossCsv(store.realizedSales);
    const yyyy = new Date().getFullYear();
    downloadCsv(`openqwnt-realized-${yyyy}.csv`, csv);
    toast.success(`Exported ${store.realizedSales.length} realized sales.`);
  }, [store.realizedSales]);

  const handleExportHoldings = useCallback(() => {
    if (store.holdings.length === 0) {
      toast.info('No holdings to export.');
      return;
    }
    const csv = holdingsSnapshotCsv(store.holdings);
    downloadCsv(`openqwnt-holdings-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success(`Exported ${store.holdings.length} holdings.`);
  }, [store.holdings]);

  // Active-account scope. null = aggregate (show everything).
  const activeAccountId = useAccountStore((s) => s.activeAccountId);
  const activeAccount = useAccountStore((s) => s.getActiveAccount());

  // Use demo data when in demo mode and portfolio is empty
  const isDemo = mode === 'demo';
  const allHoldings = store.holdings;
  const holdings = useMemo(
    () =>
      activeAccountId
        ? allHoldings.filter((h) => (h.accountId ?? 'default') === activeAccountId)
        : allHoldings,
    [allHoldings, activeAccountId]
  );
  const hasHoldings = holdings.length > 0;

  usePageContext({
    page: 'portfolio',
    primaryEntity: { type: 'portfolio', id: 'main', label: 'Portfolio' },
    visibleData: {
      kind: 'portfolio_summary',
      snapshot: {
        holdingsCount: holdings.length,
        symbols: holdings.map((h) => h.symbol),
      },
    },
  });

  // Simulate price updates for demo
  const simulatedHoldings = useMemo(() => {
    if (!isDemo || hasHoldings) return holdings;
    // If demo mode and no user holdings, show demo holdings
    return DEMO_HOLDINGS.map((h, i) => ({
      ...h,
      id: `demo-${h.symbol}`,
      currentPrice: h.avgCost * (1 + (Math.random() * 0.1 - 0.02)),
      previousClose: h.avgCost * (1 + (Math.random() * 0.05 - 0.02)),
      lastUpdated: Date.now(),
      addedAt: Date.now() - i * 86400000 * 30,
    })) as PortfolioHolding[];
  }, [isDemo, hasHoldings, holdings]);

  const displayHoldings = hasHoldings ? holdings : simulatedHoldings;

  // Computed values
  const totalValue = useMemo(() =>
    displayHoldings.reduce((sum, h) => sum + h.quantity * (h.currentPrice || h.avgCost), 0),
    [displayHoldings]
  );

  const totalCost = useMemo(() =>
    displayHoldings.reduce((sum, h) => sum + h.quantity * h.avgCost, 0),
    [displayHoldings]
  );

  const totalPnL = totalValue - totalCost;
  const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  // Realized P&L (sourced from RealizedSale records — populated when sell() is called).
  const realizedSales = store.realizedSales;
  const realizedYtd = useMemo(() => {
    const yearStart = Date.UTC(new Date().getUTCFullYear(), 0, 1);
    return realizedSales.reduce(
      (sum, r) => (r.closedAt >= yearStart ? sum + r.realizedPnL : sum),
      0
    );
  }, [realizedSales]);
  const realizedLifetime = useMemo(
    () => realizedSales.reduce((sum, r) => sum + r.realizedPnL, 0),
    [realizedSales]
  );

  const dayChange = useMemo(() => {
    let change = 0;
    displayHoldings.forEach((h) => {
      if (h.previousClose && h.currentPrice) {
        change += (h.currentPrice - h.previousClose) * h.quantity;
      }
    });
    const changePercent = totalValue > 0 ? (change / (totalValue - change)) * 100 : 0;
    return { change, changePercent };
  }, [displayHoldings, totalValue]);

  const allocations = useMemo(() => {
    if (totalValue === 0) return [];
    return displayHoldings.map((h, i) => {
      const value = h.quantity * (h.currentPrice || h.avgCost);
      return {
        symbol: h.symbol,
        name: h.name,
        assetType: h.assetType,
        value,
        weight: (value / totalValue) * 100,
        color: CHART_COLORS[i % CHART_COLORS.length],
      };
    }).sort((a, b) => b.value - a.value);
  }, [displayHoldings, totalValue]);

  // Asset type breakdown
  const assetTypeBreakdown = useMemo(() => {
    const groups: Record<string, { type: AssetType; value: number; count: number }> = {};
    displayHoldings.forEach((h) => {
      const value = h.quantity * (h.currentPrice || h.avgCost);
      if (!groups[h.assetType]) {
        groups[h.assetType] = { type: h.assetType, value: 0, count: 0 };
      }
      groups[h.assetType].value += value;
      groups[h.assetType].count += 1;
    });
    return Object.values(groups).map((g) => ({
      ...g,
      weight: totalValue > 0 ? (g.value / totalValue) * 100 : 0,
      label: ASSET_TYPE_LABELS[g.type],
      color: ASSET_COLORS[g.type],
    })).sort((a, b) => b.value - a.value);
  }, [displayHoldings, totalValue]);

  const demoHistory = useMemo(() => generateDemoHistory(), []);

  const handleRefreshPrices = useCallback(async () => {
    if (isDemo && !hasHoldings) {
      // Simulate random price updates for purely demo data
      displayHoldings.forEach((h) => {
        const changePercent = (Math.random() - 0.45) * 0.04;
        const newPrice = (h.currentPrice || h.avgCost) * (1 + changePercent);
        store.updatePrice(h.symbol, newPrice, h.currentPrice);
      });
      store.takeSnapshot();
      return;
    }

    if (displayHoldings.length === 0) return;

    setLoadingPrices(true);
    try {
      const symbols = displayHoldings.map(h => h.symbol);
      const response = await api.getPortfolioPrices(symbols);
      // Response might return {"AAPL": {"price": 180.5, "previousClose": 178.2}} directly or wrapped
      store.updatePrices(response.prices || response);
      store.takeSnapshot();
      toast.success(`Updated prices for ${symbols.length} holdings`);
    } catch (error) {
      console.error('Failed to fetch portfolio prices:', error);
      const message = error instanceof Error ? error.message : 'Price refresh failed';
      toast.error(`Could not fetch prices: ${message}`);
    } finally {
      setLoadingPrices(false);
    }
  }, [displayHoldings, store, isDemo, hasHoldings]);

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
      <TooltipProvider delayDuration={200}>
        <div className="min-h-screen bg-background pt-14">
          <div className={`p-6 ${PAGE_CONTENT_CLASS} space-y-6`}>
            {/* ─── Header ─── */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-primary" />
                <h1 className="text-foreground font-medium text-sm tracking-tight">Portfolio</h1>
                <div className="h-4 w-px bg-muted/60" />
                {isDemo && !hasHoldings && (
                  <Badge variant="outline" className="text-amber-400 border-amber-500/30 text-[10px]">
                    Demo Data
                  </Badge>
                )}
                <span className="text-muted-foreground text-xs">
                  {displayHoldings.length} holding{displayHoldings.length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Select
                      value={store.costBasisMethod}
                      onValueChange={(v) => store.setCostBasisMethod(v as CostBasisMethod)}
                    >
                      <SelectTrigger className="h-7 w-[110px] bg-muted/40 border-border/60 text-[11px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1e1e2e] border-border/60">
                        <SelectItem value="FIFO">FIFO</SelectItem>
                        <SelectItem value="LIFO">LIFO</SelectItem>
                        <SelectItem value="HIFO">HIFO</SelectItem>
                        <SelectItem value="AVERAGE">Average</SelectItem>
                      </SelectContent>
                    </Select>
                  </TooltipTrigger>
                  <TooltipContent>Cost-basis method for sells</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleRefreshPrices}
                      disabled={loadingPrices}
                      className={`p-1.5 rounded hover:bg-muted/60 transition-colors text-foreground/70 hover:text-foreground ${loadingPrices ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingPrices ? 'animate-spin' : ''}`} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Refresh prices</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setImportDialogOpen(true)}
                      className="p-1.5 rounded hover:bg-muted/60 transition-colors text-foreground/70 hover:text-foreground"
                    >
                      <Upload className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Import CSV from broker</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleExportTaxCsv}
                      className="p-1.5 rounded hover:bg-muted/60 transition-colors text-foreground/70 hover:text-foreground"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Export realized gain/loss CSV (tax)</TooltipContent>
                </Tooltip>
                <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
                  <ImportDialog onClose={() => setImportDialogOpen(false)} />
                </Dialog>
                <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                  <DialogTrigger asChild>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                      <Plus className="w-3.5 h-3.5" />
                      Add Holding
                    </button>
                  </DialogTrigger>
                  <AddHoldingDialog
                    onAdd={(holding) => {
                      store.addHolding(holding);
                      setAddDialogOpen(false);
                    }}
                    onClose={() => setAddDialogOpen(false)}
                  />
                </Dialog>
              </div>
            </div>

            {/* ─── Top Stats ─── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-2 lg:grid-cols-5 gap-4"
            >
              <PortfolioStatCard
                title="Total Value"
                value={formatCurrency(totalValue)}
                icon={<DollarSign className="w-5 h-5" />}
                color="blue"
              />
              <PortfolioStatCard
                title="Unrealized P&L"
                value={formatCurrency(totalPnL)}
                icon={totalPnL >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                color={totalPnL >= 0 ? 'green' : 'red'}
                subtitle={formatPercent(totalPnLPercent)}
              />
              <PortfolioStatCard
                title="Realized (YTD)"
                value={formatCurrency(realizedYtd)}
                icon={realizedYtd >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                color={realizedYtd >= 0 ? 'green' : 'red'}
                subtitle={`${store.costBasisMethod} · lifetime ${formatCurrency(realizedLifetime)}`}
              />
              <PortfolioStatCard
                title="Day Change"
                value={formatCurrency(dayChange.change)}
                icon={dayChange.change >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                color={dayChange.change >= 0 ? 'green' : 'red'}
                subtitle={formatPercent(dayChange.changePercent)}
              />
              <PortfolioStatCard
                title="Assets"
                value={displayHoldings.length.toString()}
                icon={<PieChartIcon className="w-5 h-5" />}
                color="purple"
                subtitle={`${assetTypeBreakdown.length} categories`}
              />
            </motion.div>

            {/* ─── Tabs ─── */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="bg-muted/40 border border-border/60">
                <TabsTrigger value="overview" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary text-xs">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="holdings" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary text-xs">
                  Holdings
                </TabsTrigger>
                <TabsTrigger value="analytics" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary text-xs">
                  Analytics
                </TabsTrigger>
              </TabsList>

              {/* ═══ OVERVIEW TAB ═══ */}
              <TabsContent value="overview" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* ─── Portfolio Value Chart ─── */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                    className="lg:col-span-2"
                  >
                    <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading-lg">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-foreground text-sm">
                          <BarChart3 className="w-4 h-4 text-primary" />
                          Portfolio Value Over Time
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={demoHistory}>
                              <defs>
                                <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                              <XAxis
                                dataKey="date"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#64748b', fontSize: 10 }}
                                interval="preserveStartEnd"
                              />
                              <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#64748b', fontSize: 10 }}
                                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                                domain={['auto', 'auto']}
                              />
                              <RechartsTooltip
                                contentStyle={{
                                  backgroundColor: '#1e1e2e',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  borderRadius: 8,
                                  fontSize: 12,
                                  color: '#e2e8f0',
                                }}
                                formatter={(value: number) => [formatCurrency(value), 'Portfolio Value']}
                              />
                              <Area
                                type="monotone"
                                dataKey="totalValue"
                                stroke="#3b82f6"
                                strokeWidth={2}
                                fill="url(#portfolioGradient)"
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  {/* ─── Allocation Pie Chart ─── */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.15 }}
                  >
                    <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-foreground text-sm">
                          <PieChartIcon className="w-4 h-4 text-purple-400" />
                          Allocation
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {allocations.length === 0 ? (
                          <Empty
                            description={<span className="text-muted-foreground text-xs">No holdings</span>}
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                          />
                        ) : (
                          <>
                            <div className="h-[200px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                  <Pie
                                    data={allocations}
                                    dataKey="value"
                                    nameKey="symbol"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={80}
                                    paddingAngle={2}
                                    strokeWidth={0}
                                  >
                                    {allocations.map((entry, i) => (
                                      <Cell key={entry.symbol} fill={entry.color} />
                                    ))}
                                  </Pie>
                                  <RechartsTooltip
                                    contentStyle={{
                                      backgroundColor: '#1e1e2e',
                                      border: '1px solid rgba(255,255,255,0.1)',
                                      borderRadius: 8,
                                      fontSize: 12,
                                      color: '#e2e8f0',
                                    }}
                                    formatter={(value: number, name: string) => [
                                      formatCurrency(value),
                                      name,
                                    ]}
                                  />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="space-y-1.5 mt-2">
                              {allocations.map((a) => (
                                <div key={a.symbol} className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2">
                                    <div
                                      className="w-2.5 h-2.5 rounded-full"
                                      style={{ backgroundColor: a.color }}
                                    />
                                    <span className="text-foreground font-medium">{a.symbol}</span>
                                  </div>
                                  <span className="text-muted-foreground">{a.weight.toFixed(1)}%</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>

                {/* ─── Quick Holdings List ─── */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.2 }}
                >
                  <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading-lg">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="flex items-center gap-2 text-foreground text-sm">
                        <Briefcase className="w-4 h-4 text-primary" />
                        Holdings
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {displayHoldings.length === 0 ? (
                        <Empty
                          description={<span className="text-muted-foreground text-xs">No holdings yet</span>}
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                        >
                          <button
                            onClick={() => setAddDialogOpen(true)}
                            className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg text-sm bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add your first holding
                          </button>
                        </Empty>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-muted-foreground border-b border-border/60">
                                <th className="text-left py-2 px-2 font-medium">Asset</th>
                                <th className="text-right py-2 px-2 font-medium">Quantity</th>
                                <th className="text-right py-2 px-2 font-medium">Avg Cost</th>
                                <th className="text-right py-2 px-2 font-medium">Price</th>
                                <th className="text-right py-2 px-2 font-medium">Value</th>
                                <th className="text-right py-2 px-2 font-medium">P&L</th>
                                <th className="text-right py-2 px-2 font-medium">Weight</th>
                                <th className="text-right py-2 px-2 font-medium w-10"></th>
                              </tr>
                            </thead>
                            <tbody>
                              {displayHoldings.map((h, idx) => {
                                const value = h.quantity * (h.currentPrice || h.avgCost);
                                const cost = h.quantity * h.avgCost;
                                const pnl = value - cost;
                                const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;
                                const weight = totalValue > 0 ? (value / totalValue) * 100 : 0;
                                const isPositive = pnl >= 0;

                                return (
                                  <motion.tr
                                    key={h.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.03 }}
                                    className="border-b border-border/60 hover:bg-muted/40 transition-colors"
                                  >
                                    <td className="py-2.5 px-2">
                                      <div className="flex items-center gap-2">
                                        <div className="p-1 rounded-md" style={{ backgroundColor: `${ASSET_COLORS[h.assetType]}15` }}>
                                          <span style={{ color: ASSET_COLORS[h.assetType] }}>
                                            {ASSET_TYPE_ICONS[h.assetType]}
                                          </span>
                                        </div>
                                        <div>
                                          <div className="text-foreground font-medium">{h.symbol}</div>
                                          <div className="text-muted-foreground text-[10px]">{h.name}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-2 text-right text-foreground font-mono">
                                      {formatNumber(h.quantity)}
                                    </td>
                                    <td className="py-2.5 px-2 text-right text-muted-foreground font-mono">
                                      {formatCurrency(h.avgCost)}
                                    </td>
                                    <td className="py-2.5 px-2 text-right text-foreground font-mono">
                                      {formatCurrency(h.currentPrice || h.avgCost)}
                                    </td>
                                    <td className="py-2.5 px-2 text-right text-foreground font-mono font-medium">
                                      {formatCurrency(value)}
                                    </td>
                                    <td className={`py-2.5 px-2 text-right font-mono ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                      <div>{formatCurrency(pnl)}</div>
                                      <div className="text-[10px]">{formatPercent(pnlPercent)}</div>
                                    </td>
                                    <td className="py-2.5 px-2 text-right">
                                      <div className="flex items-center justify-end gap-2">
                                        <Progress value={weight} className="w-12 h-1.5" />
                                        <span className="text-muted-foreground w-10 text-right">{weight.toFixed(1)}%</span>
                                      </div>
                                    </td>
                                    <td className="py-2.5 px-2 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        <AskAi
                                          target={{ type: 'symbol', id: h.symbol, label: h.symbol }}
                                          prompt={`Tell me about ${h.symbol}: recent price action, news, fundamentals, and what to watch.`}
                                        />
                                        {hasHoldings && (
                                          <button
                                            onClick={() => store.removeHolding(h.id)}
                                            className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </td>
                                  </motion.tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              {/* ═══ HOLDINGS TAB ═══ */}
              <TabsContent value="holdings" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {displayHoldings.map((h, idx) => {
                    const value = h.quantity * (h.currentPrice || h.avgCost);
                    const cost = h.quantity * h.avgCost;
                    const pnl = value - cost;
                    const pnlPercent = cost > 0 ? (pnl / cost) * 100 : 0;
                    const isPositive = pnl >= 0;
                    const assetHistory = generateAssetHistory(h.symbol, value);

                    return (
                      <motion.div
                        key={h.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading hover:border-border transition-colors">
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-md" style={{ backgroundColor: `${ASSET_COLORS[h.assetType]}15` }}>
                                  <span style={{ color: ASSET_COLORS[h.assetType] }}>
                                    {ASSET_TYPE_ICONS[h.assetType]}
                                  </span>
                                </div>
                                <div>
                                  <CardTitle className="text-sm">{h.symbol}</CardTitle>
                                  <p className="text-[10px] text-muted-foreground">{h.name}</p>
                                </div>
                              </div>
                              <Badge
                                variant="outline"
                                className="text-[10px]"
                                style={{
                                  color: ASSET_COLORS[h.assetType],
                                  borderColor: `${ASSET_COLORS[h.assetType]}40`,
                                }}
                              >
                                {ASSET_TYPE_LABELS[h.assetType]}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {/* Spark chart */}
                            <div className="h-[80px]">
                              <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={assetHistory}>
                                  <defs>
                                    <linearGradient id={`grad-${h.symbol}`} x1="0" y1="0" x2="0" y2="1">
                                      <stop offset="5%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity={0.3} />
                                      <stop offset="95%" stopColor={isPositive ? '#22c55e' : '#ef4444'} stopOpacity={0} />
                                    </linearGradient>
                                  </defs>
                                  <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke={isPositive ? '#22c55e' : '#ef4444'}
                                    strokeWidth={1.5}
                                    fill={`url(#grad-${h.symbol})`}
                                  />
                                </AreaChart>
                              </ResponsiveContainer>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <span className="text-muted-foreground">Quantity</span>
                                <p className="text-foreground font-mono font-medium">{formatNumber(h.quantity)}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Avg Cost</span>
                                <p className="text-foreground font-mono font-medium">{formatCurrency(h.avgCost)}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Current Price</span>
                                <p className="text-foreground font-mono font-medium">{formatCurrency(h.currentPrice || h.avgCost)}</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Value</span>
                                <p className="text-foreground font-mono font-medium">{formatCurrency(value)}</p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-border/60">
                              <span className="text-xs text-muted-foreground">P&L</span>
                              <div className={`flex items-center gap-1 text-xs font-medium ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                {formatCurrency(pnl)} ({formatPercent(pnlPercent)})
                              </div>
                            </div>

                            {hasHoldings && (
                              <div className="flex gap-1.5 pt-1">
                                <button
                                  onClick={() => setTradeDialog({ holdingId: h.id, side: 'buy' })}
                                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[11px] bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                                >
                                  <ArrowUpRight className="w-3 h-3" />
                                  Buy
                                </button>
                                <button
                                  onClick={() => setTradeDialog({ holdingId: h.id, side: 'sell' })}
                                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-md text-[11px] bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                                >
                                  <ArrowDownRight className="w-3 h-3" />
                                  Sell
                                </button>
                                <button
                                  onClick={() => store.removeHolding(h.id)}
                                  title="Remove holding"
                                  className="flex items-center justify-center px-2 py-1.5 rounded-md text-[11px] bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                            {hasHoldings && (
                              <div className="pt-1">
                                <button
                                  onClick={() => toggleLots(h.id)}
                                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  {expandedLots.has(h.id) ? '▾ Hide' : '▸ Show'} tax lots ({h.lots?.length ?? 0})
                                </button>
                                {expandedLots.has(h.id) && (
                                  <div className="mt-2">
                                    <LotsTable lots={h.lots ?? []} currency={h.currency} />
                                  </div>
                                )}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}

                  {/* Add Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: displayHoldings.length * 0.05 }}
                  >
                    <Card
                      className="bg-card/30 backdrop-blur-sm border-border/20 border-dashed shadow-trading hover:border-primary/40 transition-colors cursor-pointer min-h-[320px] flex items-center justify-center"
                      onClick={() => setAddDialogOpen(true)}
                    >
                      <div className="flex flex-col items-center gap-3 text-muted-foreground">
                        <div className="p-3 rounded-full bg-primary/10">
                          <Plus className="w-6 h-6 text-primary" />
                        </div>
                        <span className="text-xs">Add New Holding</span>
                      </div>
                    </Card>
                  </motion.div>
                </div>
              </TabsContent>

              {/* ═══ ANALYTICS TAB ═══ */}
              <TabsContent value="analytics" className="space-y-6">
                <RiskPanel
                  liveValuesBySymbol={Object.fromEntries(
                    displayHoldings.map((h) => [h.symbol, h.quantity * (h.currentPrice || h.avgCost)])
                  )}
                  currency={store.baseCurrency}
                />
                <MacroPanel />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <StressPanel
                    holdings={displayHoldings.map((h) => ({
                      symbol: h.symbol,
                      assetType: h.assetType,
                      value: h.quantity * (h.currentPrice || h.avgCost),
                    }))}
                    currency={store.baseCurrency}
                  />
                  <EarningsCalendar />
                </div>
                <RebalancePanel
                  positions={displayHoldings.map((h) => ({
                    symbol: h.symbol,
                    value: h.quantity * (h.currentPrice || h.avgCost),
                  }))}
                  accountId={activeAccount?.id ?? 'default'}
                />
                <AuditLogPanel />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* ─── Asset Type Breakdown Bar Chart ─── */}
                  <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-foreground text-sm">
                        <BarChart3 className="w-4 h-4 text-blue-400" />
                        Asset Class Breakdown
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={assetTypeBreakdown} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                            <XAxis
                              type="number"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: '#64748b', fontSize: 10 }}
                              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                            />
                            <YAxis
                              dataKey="label"
                              type="category"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: '#94a3b8', fontSize: 11 }}
                              width={90}
                            />
                            <RechartsTooltip
                              contentStyle={{
                                backgroundColor: '#1e1e2e',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 8,
                                fontSize: 12,
                                color: '#e2e8f0',
                              }}
                              formatter={(value: number) => [formatCurrency(value), 'Value']}
                            />
                            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                              {assetTypeBreakdown.map((entry, i) => (
                                <Cell key={entry.type} fill={entry.color} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* ─── Asset Type Pie Chart ─── */}
                  <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-foreground text-sm">
                        <PieChartIcon className="w-4 h-4 text-purple-400" />
                        Allocation by Asset Class
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={assetTypeBreakdown}
                              dataKey="value"
                              nameKey="label"
                              cx="50%"
                              cy="50%"
                              outerRadius={80}
                              label={({ label, weight }) => `${label} ${weight.toFixed(0)}%`}
                              labelLine={false}
                              strokeWidth={0}
                            >
                              {assetTypeBreakdown.map((entry) => (
                                <Cell key={entry.type} fill={entry.color} />
                              ))}
                            </Pie>
                            <RechartsTooltip
                              contentStyle={{
                                backgroundColor: '#1e1e2e',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 8,
                                fontSize: 12,
                                color: '#e2e8f0',
                              }}
                              formatter={(value: number, name: string) => [formatCurrency(value), name]}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-2 mt-4">
                        {assetTypeBreakdown.map((a) => (
                          <div key={a.type} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.color }} />
                              <span className="text-foreground">{a.label}</span>
                              <Badge variant="outline" className="text-[9px] px-1">{a.count}</Badge>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-muted-foreground">{formatCurrency(a.value)}</span>
                              <span className="text-foreground font-medium w-10 text-right">{a.weight.toFixed(1)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* ─── Top Winners / Losers ─── */}
                  <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-foreground text-sm">
                        <TrendingUp className="w-4 h-4 text-green-400" />
                        Top Performers
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {[...displayHoldings]
                          .map((h) => {
                            const cost = h.quantity * h.avgCost;
                            const value = h.quantity * (h.currentPrice || h.avgCost);
                            const pnlPercent = cost > 0 ? ((value - cost) / cost) * 100 : 0;
                            return { ...h, pnlPercent, pnl: value - cost };
                          })
                          .sort((a, b) => b.pnlPercent - a.pnlPercent)
                          .map((h, i) => {
                            const isPositive = h.pnlPercent >= 0;
                            return (
                              <div key={h.id} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/40 transition-colors">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground text-[10px] w-4">#{i + 1}</span>
                                  <span className="text-foreground text-xs font-medium">{h.symbol}</span>
                                  <span className="text-muted-foreground text-[10px]">{h.name}</span>
                                </div>
                                <div className={`flex items-center gap-1 text-xs font-mono ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                                  {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                  {formatPercent(h.pnlPercent)}
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </CardContent>
                  </Card>

                  {/* ─── Risk Metrics ─── */}
                  <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-foreground text-sm">
                        <Eye className="w-4 h-4 text-amber-400" />
                        Portfolio Metrics
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3 text-xs">
                        <MetricRow label="Total Value" value={formatCurrency(totalValue)} />
                        <MetricRow label="Total Cost Basis" value={formatCurrency(totalCost)} />
                        <MetricRow label="Unrealized P&L" value={formatCurrency(totalPnL)} valueColor={totalPnL >= 0 ? 'text-green-400' : 'text-red-400'} />
                        <MetricRow label="Return %" value={formatPercent(totalPnLPercent)} valueColor={totalPnLPercent >= 0 ? 'text-green-400' : 'text-red-400'} />
                        <div className="border-t border-border/60 pt-3" />
                        <MetricRow label="Largest Position" value={allocations[0]?.symbol ?? '-'} />
                        <MetricRow label="Largest Weight" value={allocations[0] ? `${allocations[0].weight.toFixed(1)}%` : '-'} />
                        <MetricRow label="Number of Holdings" value={displayHoldings.length.toString()} />
                        <MetricRow label="Asset Classes" value={assetTypeBreakdown.length.toString()} />
                        <MetricRow
                          label="Diversification"
                          value={
                            assetTypeBreakdown.length >= 4 ? 'Well Diversified' :
                              assetTypeBreakdown.length >= 2 ? 'Moderate' : 'Concentrated'
                          }
                          valueColor={
                            assetTypeBreakdown.length >= 4 ? 'text-green-400' :
                              assetTypeBreakdown.length >= 2 ? 'text-amber-400' : 'text-red-400'
                          }
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          {/* ─── Trade Dialog (shared buy/sell) ─── */}
          <Dialog open={!!tradeDialog} onOpenChange={(open) => !open && setTradeDialog(null)}>
            {tradeDialog && tradeHolding && (
              <TradeDialog
                holding={tradeHolding}
                side={tradeDialog.side}
                onClose={() => setTradeDialog(null)}
              />
            )}
          </Dialog>
        </div>
      </TooltipProvider>
    </ConfigProvider>
  );
};

// =============================================================================
// ADD HOLDING DIALOG
// =============================================================================

interface AddHoldingDialogProps {
  onAdd: (holding: Omit<PortfolioHolding, 'id' | 'currentPrice' | 'previousClose' | 'lastUpdated' | 'addedAt'>) => void;
  onClose: () => void;
}

const AddHoldingDialog = ({ onAdd, onClose }: AddHoldingDialogProps) => {
  const [symbol, setSymbol] = useState('');
  const [name, setName] = useState('');
  const [assetType, setAssetType] = useState<AssetType>('stock');
  const [inputMode, setInputMode] = useState<HoldingInputMode>('quantity');
  const [quantity, setQuantity] = useState('');
  const [targetPercentage, setTargetPercentage] = useState('');
  const [avgCost, setAvgCost] = useState('');
  const [currency, setCurrency] = useState('USD');

  const handleSubmit = () => {
    if (!symbol.trim()) return;

    onAdd({
      symbol: symbol.toUpperCase().trim(),
      name: name.trim() || symbol.toUpperCase().trim(),
      assetType,
      inputMode,
      quantity: inputMode === 'quantity' ? parseFloat(quantity) || 0 : 0,
      targetPercentage: inputMode === 'percentage' ? parseFloat(targetPercentage) || 0 : 0,
      avgCost: parseFloat(avgCost) || 0,
      currency,
    });
  };

  return (
    <DialogContent className="bg-[#1e1e2e] border-border/60 text-foreground max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" />
          Add Holding
        </DialogTitle>
        <DialogDescription className="text-muted-foreground text-xs">
          Add an asset to your portfolio by quantity or target percentage.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {/* Asset Type */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Asset Type</Label>
          <div className="grid grid-cols-4 gap-1.5">
            {(Object.keys(ASSET_TYPE_LABELS) as AssetType[]).map((type) => (
              <button
                key={type}
                onClick={() => setAssetType(type)}
                className={`flex flex-col items-center gap-1 p-2 rounded-lg text-[10px] transition-all ${assetType === type
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted/60 border border-transparent'
                  }`}
              >
                <span style={{ color: assetType === type ? undefined : ASSET_COLORS[type] }}>
                  {ASSET_TYPE_ICONS[type]}
                </span>
                {ASSET_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        {/* Symbol & Name */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Symbol *</Label>
            <Input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="e.g. AAPL, BTC, XAU"
              className="bg-muted/40 border-border/60 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Apple Inc."
              className="bg-muted/40 border-border/60 text-sm"
            />
          </div>
        </div>

        {/* Input Mode Toggle */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">How to specify position</Label>
          <div className="flex gap-2">
            <button
              onClick={() => setInputMode('quantity')}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${inputMode === 'quantity'
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted/60 border border-transparent'
                }`}
            >
              By Quantity
            </button>
            <button
              onClick={() => setInputMode('percentage')}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${inputMode === 'percentage'
                  ? 'bg-primary/20 text-primary border border-primary/30'
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted/60 border border-transparent'
                }`}
            >
              By Percentage
            </button>
          </div>
        </div>

        {/* Quantity OR Percentage */}
        {inputMode === 'quantity' ? (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Quantity (shares, coins, oz, etc.)</Label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 50, 0.5, 10"
              className="bg-muted/40 border-border/60 text-sm"
              min="0"
              step="any"
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Target Allocation (%)</Label>
            <Input
              type="number"
              value={targetPercentage}
              onChange={(e) => setTargetPercentage(e.target.value)}
              placeholder="e.g. 25"
              className="bg-muted/40 border-border/60 text-sm"
              min="0"
              max="100"
              step="0.1"
            />
          </div>
        )}

        {/* Average Cost */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Avg Cost Per Unit</Label>
            <Input
              type="number"
              value={avgCost}
              onChange={(e) => setAvgCost(e.target.value)}
              placeholder="e.g. 178.50"
              className="bg-muted/40 border-border/60 text-sm"
              min="0"
              step="any"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Currency</Label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="bg-muted/40 border-border/60 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1e1e2e] border-border/60">
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
                <SelectItem value="GBP">GBP</SelectItem>
                <SelectItem value="SEK">SEK</SelectItem>
                <SelectItem value="JPY">JPY</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <DialogFooter>
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!symbol.trim()}
          className="px-4 py-2 rounded-lg text-xs bg-primary/20 text-primary hover:bg-primary/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add to Portfolio
        </button>
      </DialogFooter>
    </DialogContent>
  );
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

const PortfolioStatCard = ({
  title,
  value,
  icon,
  color,
  subtitle,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'red' | 'purple';
  subtitle?: string;
}) => {
  const colorMap = {
    blue: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', glow: 'shadow-[0_0_15px_rgba(59,130,246,0.1)]' },
    green: { bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-400', glow: 'shadow-[0_0_15px_rgba(34,197,94,0.1)]' },
    red: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400', glow: 'shadow-[0_0_15px_rgba(239,68,68,0.1)]' },
    purple: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-400', glow: 'shadow-[0_0_15px_rgba(139,92,246,0.1)]' },
  };
  const c = colorMap[color];

  return (
    <Card className={`bg-card/60 backdrop-blur-sm border ${c.border} ${c.glow}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{title}</p>
            <p className={`text-xl font-bold ${c.text} font-mono`}>{value}</p>
            {subtitle && <p className={`text-[11px] ${c.text}`}>{subtitle}</p>}
          </div>
          <div className={`p-2 rounded-lg ${c.bg} ${c.text}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
};

const MetricRow = ({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) => (
  <div className="flex items-center justify-between">
    <span className="text-muted-foreground">{label}</span>
    <span className={`font-mono font-medium ${valueColor || 'text-foreground'}`}>{value}</span>
  </div>
);

export default Portfolio;
