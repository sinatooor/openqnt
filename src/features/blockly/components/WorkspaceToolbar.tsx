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
                        <Button
                            variant={showCode ? "default" : "outline"}
                            size="sm"
                            onClick={onToggleCode}
                            className={cn(
                                "transition-all duration-200",
                                showCode ? "bg-red-600 hover:bg-red-700" : "hover:shadow-[0_0_0_2px_rgba(239,68,68,0.5)]"
                            )}
                        >
                            <Code2 className="w-4 h-4 mr-2" />
                            Code
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
                            variant={showAIPanel ? "default" : "outline"}
                            size="sm"
                            onClick={onToggleAIPanel}
                            className={cn(
                                "transition-all duration-200",
                                showAIPanel ? "bg-red-600 hover:bg-red-700" : "hover:shadow-[0_0_0_2px_rgba(239,68,68,0.5)]"
                            )}
                        >
                            <Sparkles className="w-4 h-4 mr-2" />
                            AI Chat
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>AI Strategy Assistant</p>
                        <p className="text-xs text-muted-foreground mt-1">Chat with AI to generate strategies</p>
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
                            <User className="w-4 h-4 mr-2" />
                            Profile
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>User Profile</p>
                        <p className="text-xs text-muted-foreground mt-1">Manage account, saved strategies & settings</p>
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
                            <TrendingUp className="w-4 h-4 mr-2" />
                            Run & Test
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Run & Test Strategy</p>
                        <p className="text-xs text-muted-foreground mt-1">Backtest or deploy live</p>
                    </TooltipContent>
                </Tooltip>

                <Separator orientation="vertical" className="h-6" />

                <Tooltip>
                    <TooltipTrigger asChild>
                        <a href="/journal" target="_self">
                            <Button variant="outline" size="sm" className="hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200">
                                <BookOpen className="w-4 h-4 mr-2" />
                                Journal
                            </Button>
                        </a>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Trade Journal</p>
                        <p className="text-xs text-muted-foreground mt-1">View trade history & stats</p>
                    </TooltipContent>
                </Tooltip>
            </div>
        </div>
    );
};
