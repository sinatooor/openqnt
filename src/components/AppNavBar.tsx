/**
 * AppNavBar - Persistent top header navigation visible on all pages.
 */

import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Code2,
    LineChart,
    Settings,
    User,
    Briefcase,
    FlaskConical,
    Newspaper,
    ChartCandlestick,
    BotMessageSquare,
    Network,
} from 'lucide-react';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAuthStore } from '@/stores/authStore';
import { useAppModeStore } from '@/stores/appModeStore';
import { ProfileModal } from '@/features/strategy-flow/components/modals/ProfileModal';

export const APP_HEADER_HEIGHT = 56;

interface NavItemDef {
    icon: React.ReactNode;
    label: string;
    path: string;
}

const NAV_ITEMS: NavItemDef[] = [
    { icon: <LayoutDashboard className="w-4 h-4" />, label: 'Dashboard', path: '/' },
    { icon: <Code2 className="w-4 h-4" />, label: 'Builder', path: '/builder' },
    { icon: <Briefcase className="w-4 h-4" />, label: 'Portfolio', path: '/portfolio' },
    { icon: <LineChart className="w-4 h-4" />, label: 'Executions', path: '/executions' },
    { icon: <FlaskConical className="w-4 h-4" />, label: 'Research', path: '/research' },
    { icon: <Newspaper className="w-4 h-4" />, label: 'News', path: '/news' },
    { icon: <ChartCandlestick className="w-4 h-4" />, label: 'Terminal', path: '/terminal' },
    { icon: <BotMessageSquare className="w-4 h-4" />, label: 'AI Chat', path: '/ai-chat' },
    { icon: <Network className="w-4 h-4" />, label: 'Agents', path: '/agents' },
    { icon: <Settings className="w-4 h-4" />, label: 'Settings', path: '/settings' },
];

export const AppNavBar = () => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const { user } = useAuthStore();
    const { mode } = useAppModeStore();
    const [showProfile, setShowProfile] = useState(false);

    if (pathname === '/login') return null;

    const isActive = (path: string) => {
        if (path === '/') return pathname === '/';
        return pathname.startsWith(path);
    };

    return (
        <TooltipProvider delayDuration={200}>
            <nav className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-1 bg-[#252526]/95 backdrop-blur-md border border-white/10 rounded-xl px-3 py-2 shadow-2xl shadow-black/40">
                {NAV_ITEMS.map((item) => {
                    const active = isActive(item.path);
                    return (
                        <Tooltip key={item.path}>
                            <TooltipTrigger asChild>
                                <button
                                    onClick={() => navigate(item.path)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${active
                                        ? 'bg-primary/20 text-primary shadow-sm'
                                        : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                                    }`}
                                >
                                    {item.icon}
                                    <span className="hidden sm:inline whitespace-nowrap">{item.label}</span>
                                </button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="text-xs">
                                {item.label}
                            </TooltipContent>
                        </Tooltip>
                    );
                })}

                <div className="h-5 w-px bg-white/10 mx-1" />
                <Tooltip>
                    <TooltipTrigger asChild>
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider cursor-default ${
                            mode === 'demo'
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                                : 'bg-green-500/15 text-green-400 border border-green-500/20'
                        }`}>
                            {mode}
                        </span>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                        {mode === 'demo' ? 'Paper trading mode' : 'Live trading mode'} — switch in Dashboard
                    </TooltipContent>
                </Tooltip>
                <div className="h-5 w-px bg-white/10 mx-1" />
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            onClick={() => setShowProfile(true)}
                            className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/20 text-primary text-xs font-bold transition-all hover:bg-primary/30"
                        >
                            {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || <User className="w-4 h-4" />}
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">
                        {user?.name || user?.email || 'Profile'}
                    </TooltipContent>
                </Tooltip>
            </nav>

            <ProfileModal open={showProfile} onOpenChange={setShowProfile} />
        </TooltipProvider>
    );
};
