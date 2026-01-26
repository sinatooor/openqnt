
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
    Pencil,
    TrendingUp,
    Settings,
    Search,
    Sparkles,
    User,
} from "lucide-react";


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

    showAIPanel: boolean;
    onToggleAIPanel: () => void;

    // Strategy/Backtest Panel
    showStrategyPanel: boolean;
    onToggleStrategyPanel: () => void;

    // Profile Modal
    showProfileModal: boolean;
    onToggleProfileModal: () => void;

    // Journal Modal
    showJournalModal: boolean;
    onToggleJournalModal: () => void;

    // Screener Modal
    showScreenerModal: boolean;
    onToggleScreenerModal: () => void;
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
    showAIPanel,
    onToggleAIPanel,
    showStrategyPanel,
    onToggleStrategyPanel,
    showProfileModal,
    onToggleProfileModal,
    showJournalModal,
    onToggleJournalModal,
    showScreenerModal,
    onToggleScreenerModal,
}: WorkspaceToolbarProps) => {
    return (
        <div className="h-11 bg-card border-b border-border flex items-center justify-between px-3 gap-2">
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
                        className="h-7 px-2 py-1 text-sm font-medium bg-transparent border-b-2 border-primary focus:outline-none w-[180px]"
                    />
                ) : (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div
                                className="flex items-center gap-1.5 px-2 py-0.5 rounded-md cursor-pointer hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200 group"
                                onClick={onEditNameStart}
                            >
                                <h2 className="font-medium text-foreground text-sm max-w-[180px] truncate">
                                    {strategyName}
                                </h2>
                                <Pencil className="w-2.5 h-2.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
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
                            <Download className="w-3.5 h-3.5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p className="text-xs">Save workspace as XML file</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Ctrl+S</p>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={onShowTemplates} className="hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200">
                            <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                            Templates
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p className="text-xs">Load pre-built strategy templates</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Learn from examples</p>
                    </TooltipContent>
                </Tooltip>
            </div>

            {/* Search Bar */}
            <div className="flex-1 max-w-xl mx-3">
                <Button
                    variant="outline"
                    className="w-full justify-start text-muted-foreground bg-muted/50 hover:bg-muted relative h-7 text-xs hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200"
                    onClick={onShowSearch}
                >
                    <Search className="w-3.5 h-3.5 mr-1.5" />
                    Search for blocks...
                    <kbd className="pointer-events-none absolute right-2 top-[50%] translate-y-[-50%] inline-flex h-4 select-none items-center gap-0.5 rounded border bg-muted px-1 font-mono text-[9px] font-medium text-muted-foreground opacity-100">
                        <span className="text-[10px]">⌘</span>F
                    </kbd>
                </Button>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-1.5">
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={onToggleFloatingChart} className="transition-all duration-200 shadow-indigo hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)]">
                            <BarChart3 className="w-3.5 h-3.5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p className="text-xs">Open floating live chart</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Drag to reposition</p>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant={showScreenerModal ? "default" : "outline"}
                            size="sm"
                            onClick={onToggleScreenerModal}
                            className={cn(
                                "transition-all duration-200 shadow-teal hover:shadow-[0_0_0_2px_rgba(20,184,166,0.5)]",
                                showScreenerModal ? "bg-teal-600 hover:bg-teal-700" : ""
                            )}
                        >
                            <Search className="w-3.5 h-3.5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p className="text-xs">Market Screener</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Scan market for opportunities</p>
                    </TooltipContent>
                </Tooltip>



                <Separator orientation="vertical" className="h-5" />

                {/* Workspace Controls */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={onUndo} className="hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200">
                            <Undo2 className="w-3.5 h-3.5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p className="text-xs">Undo</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Ctrl+Z</p>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={onRedo} className="hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200">
                            <Redo2 className="w-3.5 h-3.5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p className="text-xs">Redo</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Ctrl+Y</p>
                    </TooltipContent>
                </Tooltip>

                <Separator orientation="vertical" className="h-5" />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={onCenter} className="hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200">
                            <Maximize2 className="w-3.5 h-3.5" />
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p className="text-xs">Center workspace</p>
                    </TooltipContent>
                </Tooltip>

                <Separator orientation="vertical" className="h-5" />

                {/* View Group */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant={showCode ? "default" : "outline"}
                            size="sm"
                            onClick={onToggleCode}
                            className={cn(
                                "transition-all duration-200",
                                showCode ? "bg-red-600 hover:bg-red-700" : "hover:shadow-[0_0_0_2px_rgba(239,68,68,0.5)]"
                            )}
                        >
                            <Code2 className="w-3.5 h-3.5 mr-1.5" />
                            Code
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p className="text-xs">Toggle code view</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">View generated strategy code</p>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant={showAIPanel ? "default" : "outline"}
                            size="sm"
                            onClick={onToggleAIPanel}
                            className={cn(
                                "transition-all duration-200",
                                showAIPanel ? "bg-red-600 hover:bg-red-700" : "hover:shadow-[0_0_0_2px_rgba(239,68,68,0.5)]"
                            )}
                        >
                            <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                            AI Chat
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p className="text-xs">AI Strategy Assistant</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Chat with AI to generate strategies</p>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant={showProfileModal ? "default" : "outline"}
                            size="sm"
                            onClick={onToggleProfileModal}
                            className={cn(
                                "transition-all duration-200",
                                showProfileModal ? "bg-blue-600 hover:bg-blue-700" : "hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)]"
                            )}
                        >
                            <User className="w-3.5 h-3.5 mr-1.5" />
                            Profile
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p className="text-xs">User Profile</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Manage account & settings</p>
                    </TooltipContent>
                </Tooltip>

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant={showStrategyPanel ? "default" : "outline"}
                            size="sm"
                            onClick={onToggleStrategyPanel}
                            className={cn(
                                "transition-all duration-200",
                                showStrategyPanel ? "bg-green-600 hover:bg-green-700" : "hover:shadow-[0_0_0_2px_rgba(34,197,94,0.5)]"
                            )}
                        >
                            <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                            Run & Test
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p className="text-xs">Run & Test Strategy</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Backtest or deploy live</p>
                    </TooltipContent>
                </Tooltip>

                <Separator orientation="vertical" className="h-5" />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            variant={showJournalModal ? "default" : "outline"}
                            size="sm"
                            onClick={onToggleJournalModal}
                            className={cn(
                                "transition-all duration-200 hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)]",
                                showJournalModal ? "bg-blue-600 hover:bg-blue-700" : ""
                            )}
                        >
                            <BookOpen className="w-3.5 h-3.5 mr-1.5" />
                            Journal
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p className="text-xs">Trade Journal</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">View trade history & stats</p>
                    </TooltipContent>
                </Tooltip>
            </div>
        </div >
    );
};