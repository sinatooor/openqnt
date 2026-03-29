/**
 * Dashboard Page - Redesigned to match Strategy Builder UI/UX
 * Uses Material UI, Ant Design, and shadcn components with the
 * same glassmorphism dark theme as the strategy flow canvas.
 */

import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { api } from '../services/api';
import { useAppModeStore } from '../stores/appModeStore';
import { motion, AnimatePresence } from 'framer-motion';

// shadcn
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// MUI
import LinearProgress from '@mui/material/LinearProgress';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';

// MUI Icons
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ScheduleIcon from '@mui/icons-material/Schedule';
import RefreshIcon from '@mui/icons-material/Refresh';

// Ant Design
import { Tag, Empty, ConfigProvider, theme as antTheme } from 'antd';
import {
  ThunderboltOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  DashboardOutlined,
  SettingOutlined,
  KeyOutlined,
  CodeOutlined,
  LineChartOutlined,
  RobotOutlined,
} from '@ant-design/icons';

// Lucide icons (same as strategy builder)
import {
  Activity,
  Zap,
  Shield,
  AlertTriangle,
  ArrowRight,
  Layers,
  Clock,
  ExternalLink,
} from 'lucide-react';
const Dashboard = () => {
  const { user, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const { mode, setMode } = useAppModeStore();
  const [stats, setStats] = useState<any>(null);
  const [strategies, setStrategies] = useState<any[]>([]);
  const [recentRuns, setRecentRuns] = useState<any[]>([]);
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    loadDashboard();
  }, [isAuthenticated]);

  const loadDashboard = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [statsData, strategiesData, runsData, portfolioData] = await Promise.allSettled([
        api.getExecutionStats(),
        api.listStrategies(),
        api.listExecutions({ page: 1 }),
        api.getPortfolios(),
      ]);
      if (statsData.status === 'fulfilled') setStats(statsData.value?.stats);
      if (strategiesData.status === 'fulfilled')
        setStrategies(strategiesData.value?.strategies ?? []);
      if (runsData.status === 'fulfilled')
        setRecentRuns(runsData.value?.runs?.slice(0, 8) ?? []);
      if (portfolioData.status === 'fulfilled') {
        setPortfolios(portfolioData.value?.portfolios ?? []);
      }
    } catch {
      /* silent */
    }
    setLoading(false);
    setRefreshing(false);
  };

  const activeStrategies = useMemo(
    () => strategies.filter((s: any) => s.status === 'active'),
    [strategies],
  );

  const successRate = stats?.successRate ?? 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <CircularProgress
            size={48}
            sx={{ color: 'hsl(217, 91%, 60%)' }}
          />
          <span className="text-muted-foreground text-sm">Loading dashboard...</span>
        </motion.div>
      </div>
    );
  }

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
          {/* ─── Refresh indicator ─── */}
          <AnimatePresence>
            {refreshing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <LinearProgress
                  sx={{
                    height: 2,
                    backgroundColor: 'transparent',
                    '& .MuiLinearProgress-bar': {
                      backgroundColor: 'hsl(217, 91%, 60%)',
                    },
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Main Content ─── */}
          <div className="w-full max-w-none space-y-6 p-4 md:p-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <DashboardOutlined className="text-primary text-lg" />
                <h1 className="text-white font-medium text-sm tracking-tight">Dashboard</h1>
                <div className="h-4 w-px bg-white/10" />
                <span className="text-white/40 text-xs">Welcome back, {user?.name ?? 'Trader'}</span>
              </div>
              <div className="flex items-center gap-2">
                {/* ─── Demo / Real Mode Toggle ─── */}
                <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-1 py-0.5">
                  <button
                    onClick={() => setMode('demo')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                      mode === 'demo'
                        ? 'bg-amber-500/20 text-amber-400 shadow-sm border border-amber-500/30'
                        : 'text-white/40 hover:text-white/60'
                    }`}
                  >
                    Demo
                  </button>
                  <button
                    onClick={() => setMode('real')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                      mode === 'real'
                        ? 'bg-green-500/20 text-green-400 shadow-sm border border-green-500/30'
                        : 'text-white/40 hover:text-white/60'
                    }`}
                  >
                    Real
                  </button>
                </div>
                <div className="h-5 w-px bg-white/10" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => loadDashboard(true)}
                      className="p-1.5 rounded hover:bg-white/10 transition-colors text-white/60 hover:text-white"
                    >
                      <RefreshIcon
                        sx={{ fontSize: 18 }}
                        className={refreshing ? 'animate-spin' : ''}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Refresh data</TooltipContent>
                </Tooltip>
                <button
                  onClick={() => api.emergencyKill()}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Emergency Kill</span>
                </button>
              </div>
            </div>

            {/* ─── Stats Row ─── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-2 lg:grid-cols-4 gap-4"
            >
              <StatCard
                title="Total Runs"
                value={stats?.totalRuns ?? 0}
                icon={<Activity className="w-5 h-5" />}
                color="blue"
                subtitle="lifetime executions"
              />
              <StatCard
                title="Success Rate"
                value={`${successRate}%`}
                icon={<Shield className="w-5 h-5" />}
                color="green"
                subtitle={successRate >= 80 ? 'excellent' : successRate >= 50 ? 'good' : 'needs work'}
                progress={successRate}
              />
              <StatCard
                title="Errors"
                value={stats?.errorRuns ?? 0}
                icon={<AlertTriangle className="w-5 h-5" />}
                color="red"
                subtitle="failed runs"
              />
              <StatCard
                title="Active Strategies"
                value={activeStrategies.length}
                icon={<Zap className="w-5 h-5" />}
                color="purple"
                subtitle={`of ${strategies.length} total`}
              />
            </motion.div>

            {/* ─── Main Two-Column Layout ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* ─── Strategies Panel (2/3) ─── */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="lg:col-span-2"
              >
                <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading-lg">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="flex items-center gap-2 text-foreground">
                      <Layers className="w-4 h-4 text-primary" />
                      Strategies
                    </CardTitle>
                    <button
                      onClick={() => navigate('/')}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    >
                      <CodeOutlined />
                      New Strategy
                    </button>
                  </CardHeader>
                  <CardContent>
                    {strategies.length === 0 ? (
                      <Empty
                        description={
                          <span className="text-muted-foreground text-xs">
                            No strategies yet
                          </span>
                        }
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      >
                        <button
                          onClick={() => navigate('/')}
                          className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg text-sm bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
                        >
                          <RocketOutlined />
                          Create your first strategy
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </Empty>
                    ) : (
                      <ScrollArea className="h-[320px]">
                        <div className="space-y-1">
                          {strategies.map((s: any, i: number) => (
                            <motion.div
                              key={s.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.03 }}
                              className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group"
                              onClick={() => navigate('/')}
                            >
                              <div className="flex items-center gap-3">
                                <div
                                  className={`w-2 h-2 rounded-full ${s.status === 'active'
                                      ? 'bg-green-400 shadow-[0_0_6px_rgba(34,197,94,0.5)]'
                                      : 'bg-white/20'
                                    }`}
                                />
                                <div>
                                  <span className="text-foreground text-sm font-medium group-hover:text-white transition-colors">
                                    {s.name}
                                  </span>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-muted-foreground text-[11px]">
                                      v{s.currentVersion}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Tag
                                  color={s.status === 'active' ? 'green' : 'default'}
                                  className="text-[10px] leading-tight !mr-0"
                                  bordered={false}
                                >
                                  {s.status}
                                </Tag>
                                <ArrowRight className="w-3.5 h-3.5 text-white/0 group-hover:text-white/40 transition-colors" />
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </motion.div>

              {/* ─── Right Sidebar Panel (1/3) ─── */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15 }}
                className="space-y-6"
              >
                {/* Quick Actions */}
                <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-foreground">
                      <ThunderboltOutlined className="text-amber-400" />
                      Quick Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-2">
                    <QuickActionButton
                      icon={<CodeOutlined />}
                      label="Strategy Builder"
                      onClick={() => navigate('/')}
                      color="purple"
                    />
                    <QuickActionButton
                      icon={<KeyOutlined />}
                      label="Credentials"
                      onClick={() => navigate('/credentials')}
                      color="amber"
                    />
                    <QuickActionButton
                      icon={<SettingOutlined />}
                      label="Agent Config"
                      onClick={() => navigate('/agent')}
                      color="blue"
                    />
                    <QuickActionButton
                      icon={<RobotOutlined />}
                      label="ADK Agents"
                      onClick={() => navigate('/adk')}
                      color="rose"
                    />
                    <QuickActionButton
                      icon={<SafetyCertificateOutlined />}
                      label="Settings"
                      onClick={() => navigate('/settings')}
                      color="green"
                    />
                  </CardContent>
                </Card>

                {/* System Health */}
                <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-foreground">
                      <Activity className="w-4 h-4 text-green-400" />
                      System Health
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <HealthIndicator label="API" status="operational" />
                    <HealthIndicator
                      label="Strategies"
                      status={strategies.length > 0 ? 'operational' : 'idle'}
                    />
                    <HealthIndicator
                      label="Success Rate"
                      status={
                        successRate >= 80
                          ? 'operational'
                          : successRate >= 50
                            ? 'warning'
                            : 'degraded'
                      }
                    />
                  </CardContent>
                </Card>

                {/* Portfolio Snapshot */}
                <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-foreground">
                      <LineChartOutlined className="text-emerald-400" />
                      Portfolio Snapshot
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    {portfolios.length === 0 ? (
                      <p className="text-muted-foreground">
                        No portfolios connected yet. Connect a broker in Credentials to see live positions.
                      </p>
                    ) : (
                      <>
                        <p className="text-muted-foreground">
                          {portfolios.length} portfolio{portfolios.length > 1 ? 's' : ''} connected
                        </p>
                        <div className="space-y-2">
                          {portfolios.slice(0, 3).map((p: any) => (
                            <div
                              key={p.id}
                              className="flex items-center justify-between px-2 py-1.5 rounded-md bg-white/5"
                            >
                              <div>
                                <div className="text-foreground text-xs font-medium">
                                  {String(p.brokerName || 'Broker').toUpperCase()}
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                  {p.accountId || 'Account linked'}
                                </div>
                              </div>
                              <Badge className="text-[10px]" variant="outline">
                                {(p.positions?.length ?? 0)} positions
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            {/* ─── Execution History ─── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading-lg">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    Recent Executions
                  </CardTitle>
                  <button
                    onClick={() => navigate('/executions')}
                    className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
                  >
                    View all
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </CardHeader>
                <CardContent>
                  {recentRuns.length === 0 ? (
                    <Empty
                      description={
                        <span className="text-muted-foreground text-xs">
                          No execution runs yet
                        </span>
                      }
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  ) : (
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-1">
                        {recentRuns.map((run: any, i: number) => (
                          <motion.div
                            key={run.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.03 }}
                            className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer group"
                            onClick={() => navigate(`/execution/${run.id}`)}
                          >
                            <div className="flex items-center gap-3">
                              <StatusIcon status={run.status} />
                              <div>
                                <span className="text-foreground text-sm font-medium group-hover:text-white transition-colors">
                                  {run.strategy?.name ?? 'Unknown'}
                                </span>
                                <div className="flex items-center gap-3 mt-0.5">
                                  <Chip
                                    label={run.triggerType ?? 'manual'}
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                      height: 18,
                                      fontSize: '10px',
                                      color: '#94a3b8',
                                      borderColor: 'rgba(148,163,184,0.2)',
                                      '& .MuiChip-label': { px: 1 },
                                    }}
                                  />
                                  <span className="text-muted-foreground text-[11px] flex items-center gap-1">
                                    <ScheduleIcon sx={{ fontSize: 11 }} />
                                    {run.durationMs ? `${run.durationMs}ms` : '-'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-muted-foreground text-[11px] font-mono">
                                {new Date(run.startedAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              <RunStatusBadge status={run.status} />
                              <ArrowRight className="w-3.5 h-3.5 text-white/0 group-hover:text-white/40 transition-colors" />
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </motion.div>

          </div>

        </div>
      </TooltipProvider>
    </ConfigProvider>
  );
};

/* ─── Sub-Components ─── */

const StatCard = ({
  title,
  value,
  icon,
  color,
  subtitle,
  progress,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'red' | 'purple';
  subtitle?: string;
  progress?: number;
}) => {
  const colorMap = {
    blue: {
      bg: 'bg-blue-500/10',
      border: 'border-blue-500/20',
      text: 'text-blue-400',
      glow: 'shadow-[0_0_15px_rgba(59,130,246,0.1)]',
    },
    green: {
      bg: 'bg-green-500/10',
      border: 'border-green-500/20',
      text: 'text-green-400',
      glow: 'shadow-[0_0_15px_rgba(34,197,94,0.1)]',
    },
    red: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      text: 'text-red-400',
      glow: 'shadow-[0_0_15px_rgba(239,68,68,0.1)]',
    },
    purple: {
      bg: 'bg-purple-500/10',
      border: 'border-purple-500/20',
      text: 'text-purple-400',
      glow: 'shadow-[0_0_15px_rgba(139,92,246,0.1)]',
    },
  };

  const c = colorMap[color];

  return (
    <Card
      className={`bg-card/60 backdrop-blur-sm border ${c.border} ${c.glow} hover-lift`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
              {title}
            </p>
            <p className={`text-2xl font-bold ${c.text} trading-number`}>
              {value}
            </p>
            {subtitle && (
              <p className="text-muted-foreground text-[11px]">{subtitle}</p>
            )}
          </div>
          <div className={`p-2 rounded-lg ${c.bg} ${c.text}`}>
            {icon}
          </div>
        </div>
        {progress !== undefined && (
          <div className="mt-3">
            <Progress value={progress} className="h-1.5" />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const QuickActionButton = ({
  icon,
  label,
  onClick,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color: 'purple' | 'amber' | 'blue' | 'green' | 'rose';
}) => {
  const colorMap = {
    purple: 'hover:bg-purple-500/10 hover:border-purple-500/20 text-purple-400',
    amber: 'hover:bg-amber-500/10 hover:border-amber-500/20 text-amber-400',
    blue: 'hover:bg-blue-500/10 hover:border-blue-500/20 text-blue-400',
    green: 'hover:bg-green-500/10 hover:border-green-500/20 text-green-400',
    rose: 'hover:bg-rose-500/10 hover:border-rose-500/20 text-rose-400',
  };

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border border-white/5 bg-white/[0.02] ${colorMap[color]} transition-all cursor-pointer hover-lift`}
    >
      <span className="text-lg">{icon}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </button>
  );
};

const HealthIndicator = ({
  label,
  status,
}: {
  label: string;
  status: 'operational' | 'warning' | 'degraded' | 'idle';
}) => {
  const config = {
    operational: { color: 'bg-green-400', text: 'text-green-400', label: 'Operational' },
    warning: { color: 'bg-amber-400', text: 'text-amber-400', label: 'Warning' },
    degraded: { color: 'bg-red-400', text: 'text-red-400', label: 'Degraded' },
    idle: { color: 'bg-white/30', text: 'text-white/40', label: 'Idle' },
  };
  const c = config[status];

  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${c.color}`} />
        <span className={`text-[11px] ${c.text}`}>{c.label}</span>
      </div>
    </div>
  );
};

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'success':
      return (
        <div className="p-1.5 rounded-lg bg-green-500/10">
          <CheckCircleOutlineIcon sx={{ fontSize: 16, color: '#22c55e' }} />
        </div>
      );
    case 'error':
      return (
        <div className="p-1.5 rounded-lg bg-red-500/10">
          <ErrorOutlineIcon sx={{ fontSize: 16, color: '#ef4444' }} />
        </div>
      );
    case 'running':
      return (
        <div className="p-1.5 rounded-lg bg-blue-500/10">
          <PlayArrowIcon sx={{ fontSize: 16, color: '#3b82f6' }} />
        </div>
      );
    default:
      return (
        <div className="p-1.5 rounded-lg bg-white/5">
          <ScheduleIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
        </div>
      );
  }
};

const RunStatusBadge = ({ status }: { status: string }) => {
  const map: Record<string, { color: string; bg: string }> = {
    success: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
    error: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    running: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
    skipped: { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  };
  const c = map[status] ?? map.skipped;

  return (
    <Badge
      className="text-[10px]"
      style={{ backgroundColor: c.bg, color: c.color, borderColor: 'transparent' }}
    >
      {status}
    </Badge>
  );
};



export default Dashboard;
