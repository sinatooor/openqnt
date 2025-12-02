/**
 * Workspace toolbar component
 * Contains all action bar controls for the Blockly workspace
 */

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Upload,
  BookOpen,
  Search,
  BarChart3,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Code2,
  Pencil,
} from "lucide-react";

interface WorkspaceToolbarProps {
  // Strategy name
  strategyName: string;
  isEditingName: boolean;
  onStrategyNameChange: (name: string) => void;
  onEditingNameChange: (editing: boolean) => void;

  // File operations
  onSaveWorkspace: () => void;
  onLoadWorkspace: () => void;
  onShowTemplates: () => void;

  // Search
  onShowSearch: () => void;

  // Chart
  showFloatingChart: boolean;
  onToggleFloatingChart: () => void;

  // Workspace controls
  onUndo: () => void;
  onRedo: () => void;

  // Zoom
  zoomLevel: number;
  onZoom: (direction: "in" | "out") => void;
  onCenterWorkspace: () => void;

  // Code view
  showCode: boolean;
  onToggleCode: () => void;
}

export const WorkspaceToolbar = ({
  strategyName,
  isEditingName,
  onStrategyNameChange,
  onEditingNameChange,
  onSaveWorkspace,
  onLoadWorkspace,
  onShowTemplates,
  onShowSearch,
  showFloatingChart,
  onToggleFloatingChart,
  onUndo,
  onRedo,
  zoomLevel,
  onZoom,
  onCenterWorkspace,
  showCode,
  onToggleCode,
}: WorkspaceToolbarProps) => {
  return (
    <div className="h-14 bg-card border-b border-border flex items-center justify-between px-4 gap-3">
      <div className="flex items-center gap-3">
        {isEditingName ? (
          <input
            type="text"
            value={strategyName}
            onChange={(e) => onStrategyNameChange(e.target.value)}
            onBlur={() => onEditingNameChange(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onEditingNameChange(false);
            }}
            autoFocus
            className="h-8 px-2 py-1 text-lg font-semibold bg-transparent border-b-2 border-primary focus:outline-none w-[200px]"
          />
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200 group"
                onClick={() => onEditingNameChange(true)}
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

      <div className="flex items-center gap-2">
        {/* File Operations Group */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onSaveWorkspace}
              className="save-workspace-trigger hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200"
            >
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
            <Button
              variant="outline"
              size="sm"
              onClick={onLoadWorkspace}
              className="hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200"
            >
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
            <Button
              variant="outline"
              size="sm"
              onClick={onShowTemplates}
              className="hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200"
            >
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

      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleFloatingChart}
              className="transition-all duration-200 shadow-indigo hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)]"
            >
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
            <Button
              variant="outline"
              size="sm"
              onClick={onUndo}
              className="hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200"
            >
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
            <Button
              variant="outline"
              size="sm"
              onClick={onRedo}
              className="hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200"
            >
              <Redo2 className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Redo</p>
            <p className="text-xs text-muted-foreground mt-1">Ctrl+Y</p>
          </TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6" />

        {/* Zoom Controls */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onZoom("out")}
              className="hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Zoom out</p>
          </TooltipContent>
        </Tooltip>

        <Badge variant="secondary" className="px-2 min-w-[60px] justify-center mx-1">
          {zoomLevel}%
        </Badge>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onZoom("in")}
              className="hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Zoom in</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={onCenterWorkspace}
              className="hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200"
            >
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
              variant="outline"
              size="sm"
              onClick={onToggleCode}
              className="transition-all duration-200 hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)]"
            >
              <Code2 className="w-4 h-4 mr-2" />
              {showCode ? "Hide" : "Code"}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Toggle code view</p>
            <p className="text-xs text-muted-foreground mt-1">View generated strategy code</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};
