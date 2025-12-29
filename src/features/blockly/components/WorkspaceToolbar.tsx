import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
    Code2,
    Download,
    Upload,
    Undo2,
    Redo2,
    Maximize2,
    BarChart3,
    BookOpen,
    Search,
    Pencil,
    TrendingUp,
    Loader2,
    History as HistoryIcon,
} from "lucide-react";
import { BacktestResult } from "@/features/backtest/logic/engine";

export interface WorkspaceToolbarProps {
    // Strategy name
    strategyName: string;
    isEditingName: boolean;
    onStrategyNameChange: (name: string) => void;
    onEditNameStart: () => void;
    onEditNameEnd: () => void;

    // File operations
    onSave: () => void;
    onLoad: () => void;
    onShowTemplates: () => void;

    // Search
    onShowSearch: () => void;

    // Chart
    showFloatingChart: boolean;
    onToggleFloatingChart: () => void;

    // Workspace controls
    onUndo: () => void;
    onRedo: () => void;
    onCenter: () => void;

    // View toggles
    showCode: boolean;
    onToggleCode: () => void;

    showIGPanel: boolean;
    onToggleIGPanel: () => void;

    // Strategy/Backtest
    backtestResult: BacktestResult | null;
    isBacktesting: boolean;
    onRunBacktest: () => void;
}

export const WorkspaceToolbar = ({
    strategyName,
    isEditingName,
    onStrategyNameChange,
    onEditNameStart,
    onEditNameEnd,
    onSave,
    onLoad,
    onShowTemplates,
    onShowSearch,
    showFloatingChart,
    onToggleFloatingChart,
    onUndo,
    onRedo,
    onCenter,
    showCode,
    onToggleCode,
    showIGPanel,
    onToggleIGPanel,
    backtestResult,
    isBacktesting,
    onRunBacktest,
}: WorkspaceToolbarProps) => {
    return (
        <div className="h-14 bg-card border-b border-border flex items-center justify-between px-4 gap-3">
            {/* Strategy Name */}
            <div className="flex items-center gap-3">
                {isEditingName ? (
                    <input
                        type="text"
                        value={strategyName}
                        onChange={(e) => onStrategyNameChange(e.target.value)}
                        onBlur={onEditNameEnd}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') onEditNameEnd();
                        }}
                        autoFocus
                        className="h-8 px-2 py-1 text-lg font-semibold bg-transparent border-b-2 border-primary focus:outline-none w-[200px]"
                    />
                ) : (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div
                                className="flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200 group"
                                onClick={onEditNameStart}
                            >
                                <h2 className="font-semibold text-foreground text-lg max-w-[200px] truncate">
                                    {strategyName}
                                </h2>
                                <Pencil className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>Rename</TooltipContent>
                    </Tooltip>
                )}
            </div>

            {/* File Operations */}
            <div className="flex items-center gap-2">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={onSave} className="save-workspace-trigger hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200">
                            <Download className="w-4 h-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Save workspace as XML file</p>
                        <p className="text-xs text-muted-foreground mt-1">Ctrl+S</p>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={onLoad} className="hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200">
                            <Upload className="w-4 h-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Load workspace from XML file</p>
                        <p className="text-xs text-muted-foreground mt-1">Ctrl+O</p>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={onShowTemplates} className="hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200">
                            <BookOpen className="w-4 h-4 mr-2" />
                            Templates
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Load pre-built strategy templates</p>
                        <p className="text-xs text-muted-foreground mt-1">Learn from examples</p>
                    </TooltipContent>
                </Tooltip>
            </div>

            {/* Search Bar */}
            <div className="flex-1 max-w-xl mx-4">
                <Button
                    variant="outline"
                    className="w-full justify-start text-muted-foreground bg-muted/50 hover:bg-muted relative h-9 hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200"
                    onClick={onShowSearch}
                >
                    <Search className="w-4 h-4 mr-2" />
                    Search for blocks...
                    <kbd className="pointer-events-none absolute right-2 top-[50%] translate-y-[-50%] inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                        <span className="text-xs">⌘</span>F
                    </kbd>
                </Button>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-2">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={onToggleFloatingChart} className="transition-all duration-200 shadow-indigo hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)]">
                            <BarChart3 className="w-4 h-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Open floating live chart</p>
                        <p className="text-xs text-muted-foreground mt-1">Drag to reposition</p>
                    </TooltipContent>
                </Tooltip>

                <Separator orientation="vertical" className="h-6" />

                {/* Workspace Controls */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={onUndo} className="hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200">
                            <Undo2 className="w-4 h-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Undo</p>
                        <p className="text-xs text-muted-foreground mt-1">Ctrl+Z</p>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={onRedo} className="hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200">
                            <Redo2 className="w-4 h-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Redo</p>
                        <p className="text-xs text-muted-foreground mt-1">Ctrl+Y</p>
                    </TooltipContent>
                </Tooltip>

                <Separator orientation="vertical" className="h-6" />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={onCenter} className="hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200">
                            <Maximize2 className="w-4 h-4" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Center workspace</p>
                    </TooltipContent>
                </Tooltip>

                <Separator orientation="vertical" className="h-6" />

                {/* View Group */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={onToggleCode} className="transition-all duration-200 hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)]">
                            <Code2 className="w-4 h-4 mr-2" />
                            {showCode ? "Hide" : "Code"}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Toggle code view</p>
                        <p className="text-xs text-muted-foreground mt-1">View generated strategy code</p>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant={showIGPanel ? "default" : "outline"}
                            size="sm"
                            onClick={onToggleIGPanel}
                            className={cn(
                                "transition-all duration-200",
                                showIGPanel ? "bg-green-600 hover:bg-green-700" : "hover:shadow-[0_0_0_2px_rgba(34,197,94,0.5)]"
                            )}
                        >
                            <TrendingUp className="w-4 h-4 mr-2" />
                            {showIGPanel ? "Hide" : "Trade"}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Live Trading (IG)</p>
                        <p className="text-xs text-muted-foreground mt-1">Connect to IG for live trading</p>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant={backtestResult ? "default" : "outline"}
                            size="sm"
                            onClick={onRunBacktest}
                            disabled={isBacktesting}
                            className={cn(
                                "transition-all duration-200",
                                backtestResult ? "bg-purple-600 hover:bg-purple-700" : "hover:shadow-[0_0_0_2px_rgba(147,51,234,0.5)]"
                            )}
                        >
                            {isBacktesting ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <HistoryIcon className="w-4 h-4 mr-2" />
                            )}
                            Strategy
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Run Strategy Backtest</p>
                        <p className="text-xs text-muted-foreground mt-1">Analyze your strategy performance</p>
                    </TooltipContent>
                </Tooltip>
            </div>
        </div>
    );
};
