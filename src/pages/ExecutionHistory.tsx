import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useExecutionStore } from '../stores/executionStore';
import { useAuthStore } from '../stores/authStore';
import { motion } from 'framer-motion';
import {
    Activity,
    Clock,
    Layers,
    ArrowRight,
    AlertTriangle,
    Zap,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PAGE_CONTENT_CLASS } from '@/components/PageHeader';
import { ConfigProvider, theme as antTheme, Empty, Tag } from 'antd';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import ScheduleIcon from '@mui/icons-material/Schedule';

const ExecutionHistory = () => {
    const { isAuthenticated } = useAuthStore();
    const { runs, pagination, isLoading, fetchRuns } = useExecutionStore();
    const navigate = useNavigate();
    const [statusFilter, setStatusFilter] = useState<string>('');

    useEffect(() => {
        if (!isAuthenticated) { navigate('/login'); return; }
        fetchRuns({ status: statusFilter || undefined });
    }, [isAuthenticated, statusFilter]);

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
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <Activity className="w-5 h-5 text-primary" />
                            <h1 className="text-white font-medium text-sm tracking-tight">Execution History</h1>
                            <div className="h-4 w-px bg-white/10" />
                            <span className="text-white/40 text-xs">{pagination.total} total runs</span>
                        </div>
                    </div>
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-2 overflow-x-auto pb-2"
                    >
                        {['', 'success', 'error', 'running', 'pending_approval', 'skipped'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`px-4 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap border ${statusFilter === status
                                    ? 'bg-primary/20 border-primary/40 text-primary'
                                    : 'bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:text-foreground'
                                    }`}
                            >
                                {status ? status.charAt(0).toUpperCase() + status.slice(1) : 'All Runs'}
                            </button>
                        ))}
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <Card className="bg-card/60 backdrop-blur-sm border-border/30 shadow-trading-lg rounded-xl overflow-hidden">
                            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-white/5 border-b border-white/5">
                                <CardTitle className="flex items-center gap-2 text-foreground text-sm font-medium">
                                    <Clock className="w-4 h-4 text-muted-foreground" />
                                    Execution Log
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
                                        <CircularProgress size={32} sx={{ color: 'hsl(217, 91%, 60%)' }} />
                                        <span className="text-sm">Loading runs...</span>
                                    </div>
                                ) : runs.length === 0 ? (
                                    <div className="py-16">
                                        <Empty
                                            description={<span className="text-muted-foreground">No execution runs found.</span>}
                                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                                        />
                                    </div>
                                ) : (
                                    <div className="flex flex-col divide-y divide-white/5">
                                        {/* Table Header */}
                                        <div className="hidden sm:flex items-center px-6 py-3 bg-black/20 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                            <div className="flex-[2]">Strategy</div>
                                            <div className="flex-1">Trigger</div>
                                            <div className="flex-1">Status</div>
                                            <div className="flex-1">Nodes</div>
                                            <div className="flex-1">Duration</div>
                                            <div className="flex-1 text-right">Started</div>
                                        </div>

                                        <ScrollArea className="h-[60vh] max-h-[600px]">
                                            {runs.map((run: any, i: number) => (
                                                <motion.div
                                                    key={run.id}
                                                    initial={{ opacity: 0, x: -10 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: Math.min(i * 0.03, 0.3) }}
                                                    onClick={() => navigate(`/execution/${run.id}`)}
                                                    className="flex flex-col sm:flex-row sm:items-center px-6 py-4 hover:bg-white/[0.03] transition-colors cursor-pointer group gap-4 sm:gap-0"
                                                >
                                                    {/* Strategy Name */}
                                                    <div className="flex-[2] flex items-center gap-3">
                                                        <div className={`w-2 h-2 rounded-full ${run.status === 'success' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' :
                                                            run.status === 'error' ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' :
                                                                run.status === 'running' ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]' :
                                                                    'bg-slate-500'
                                                            }`} />
                                                        <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                                            {run.strategy?.name ?? 'Deleted Strategy'}
                                                        </span>
                                                    </div>

                                                    {/* Trigger */}
                                                    <div className="flex-1">
                                                        <Chip
                                                            label={run.triggerType ?? 'manual'}
                                                            size="small"
                                                            variant="outlined"
                                                            sx={{
                                                                height: 20,
                                                                fontSize: '11px',
                                                                color: '#94a3b8',
                                                                borderColor: 'rgba(148,163,184,0.2)',
                                                            }}
                                                        />
                                                    </div>

                                                    {/* Status */}
                                                    <div className="flex-1">
                                                        <RunStatusBadge status={run.status} />
                                                    </div>

                                                    {/* Nodes */}
                                                    <div className="flex-1 text-sm text-muted-foreground flex items-center gap-1">
                                                        <Layers className="w-3.5 h-3.5" />
                                                        {run.nodesExecuted} / {run.nodesExecuted + run.nodesSkipped + run.nodesErrored}
                                                        {run.nodesErrored > 0 && (
                                                            <span className="text-red-400 flex items-center ml-1">
                                                                ({run.nodesErrored}<AlertTriangle className="w-3 h-3 ml-0.5" />)
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Duration */}
                                                    <div className="flex-1 text-sm text-muted-foreground flex items-center gap-1.5">
                                                        <ScheduleIcon sx={{ fontSize: 14 }} />
                                                        {run.durationMs ? `${run.durationMs}ms` : '—'}
                                                    </div>

                                                    {/* Started At */}
                                                    <div className="flex-1 text-right text-xs text-muted-foreground font-mono">
                                                        {new Date(run.startedAt).toLocaleString(undefined, {
                                                            month: 'short', day: 'numeric',
                                                            hour: '2-digit', minute: '2-digit', second: '2-digit'
                                                        })}
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </ScrollArea>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </motion.div>

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 pt-4 pb-8">
                            {Array.from({ length: pagination.totalPages }, (_, i) => (
                                <button
                                    key={i + 1}
                                    onClick={() => fetchRuns({ page: i + 1, status: statusFilter || undefined })}
                                    className={`w-8 h-8 rounded-md flex items-center justify-center text-sm transition-colors ${pagination.page === i + 1
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-card border border-border/50 text-muted-foreground hover:bg-white/10 hover:text-foreground'
                                        }`}
                                >
                                    {i + 1}
                                </button>
                            ))}
                        </div>
                    )}
                </main>
            </div>
        </ConfigProvider>
    );
};

const RunStatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, { color: string; bg: string }> = {
        success: { color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
        error: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
        running: { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
        pending_approval: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
        skipped: { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
    };
    const c = map[status] ?? map.skipped;

    return (
        <Badge
            className="text-[11px] font-medium tracking-wide uppercase px-2 py-0.5"
            style={{ backgroundColor: c.bg, color: c.color, borderColor: 'transparent' }}
        >
            {status}
        </Badge>
    );
};

export default ExecutionHistory;
