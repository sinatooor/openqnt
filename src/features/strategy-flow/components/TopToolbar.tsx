/**
 * TopToolbar - Strategy name, save/load, run controls
 */

import { memo, useState, useRef, useEffect } from 'react';
import {
  Save,
  FolderOpen,
  Download,
  Upload,
  Play,
  Square,
  Settings,
  Code2,
  FileCode,
  MoreHorizontal,
  Check,
  X,
  Edit2,
  Layers,
  LineChart,
  Sparkles,
} from 'lucide-react';
import { useStrategyFlowStore } from '../store/strategyFlowStore';

interface TopToolbarProps {
  className?: string;
  onOpenBacktest?: () => void;
  onOpenSettings?: () => void;
  onOpenTemplates?: () => void;
  onOpenCode?: () => void;
  onOpenChart?: () => void;
  onOpenAI?: () => void;
}

export const TopToolbar = memo(({ 
  className = '',
  onOpenBacktest,
  onOpenSettings,
  onOpenTemplates,
  onOpenCode,
  onOpenChart,
  onOpenAI,
}: TopToolbarProps) => {
  const {
    strategyName,
    setStrategyName,
    isModified,
    isRunning,
    setIsRunning,
    exportStrategy,
    importStrategy,
    clearCanvas,
  } = useStrategyFlowStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(strategyName);
  const [showMenu, setShowMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSaveName = () => {
    if (editedName.trim()) {
      setStrategyName(editedName.trim());
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedName(strategyName);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  const handleExport = () => {
    const json = exportStrategy();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${strategyName.replace(/\s+/g, '_')}.strategy.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowMenu(false);
  };

  const handleImport = () => {
    fileInputRef.current?.click();
    setShowMenu(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = event.target?.result as string;
        importStrategy(json);
      } catch (error) {
        alert('Failed to import strategy file');
      }
    };
    reader.readAsText(file);
  };

  const handleRun = () => {
    setIsRunning(!isRunning);
  };

  return (
    <div className={`absolute top-0 left-0 right-0 z-20 ${className}`}>
      <div className="flex items-center justify-between px-4 py-2 bg-[#252526]/90 backdrop-blur-sm border-b border-white/10">
        {/* Left: Strategy Name */}
        <div className="flex items-center gap-3">
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onKeyDown={handleKeyDown}
                className="bg-[#1a1a1a] border border-white/20 rounded px-2 py-1 text-white text-sm focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleSaveName}
                className="p-1 rounded hover:bg-green-500/20 text-green-400"
              >
                <Check className="w-4 h-4" />
              </button>
              <button
                onClick={handleCancelEdit}
                className="p-1 rounded hover:bg-red-500/20 text-red-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setEditedName(strategyName);
                setIsEditing(true);
              }}
              className="flex items-center gap-2 group"
            >
              <span className="text-white font-medium">{strategyName}</span>
              {isModified && (
                <span className="text-white/40 text-sm">•</span>
              )}
              <Edit2 className="w-3.5 h-3.5 text-white/40 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
        </div>

        {/* Center: Run Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAI}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors ai-panel-trigger"
            title="AI Strategy Builder"
          >
            <Sparkles className="w-4 h-4" />
            AI Builder
          </button>

          <button
            onClick={onOpenTemplates}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Strategy Templates"
          >
            <Layers className="w-4 h-4" />
            Templates
          </button>
          
          <button
            onClick={onOpenChart}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Price Chart"
          >
            <LineChart className="w-4 h-4" />
            Chart
          </button>

          <button
            onClick={onOpenBacktest || handleRun}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg font-medium text-sm transition-colors ${
              isRunning
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            }`}
          >
            {isRunning ? (
              <>
                <Square className="w-4 h-4" />
                Stop
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Backtest
              </>
            )}
          </button>
        </div>

        {/* Right: File Operations */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {/* Save to server */}}
            className="p-2 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            title="Save (Ctrl+S)"
          >
            <Save className="w-4 h-4" />
          </button>

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"
              title="More options"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-[#252526] border border-white/10 rounded-lg shadow-xl overflow-hidden z-50">
                <button
                  onClick={handleExport}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-white/80 hover:bg-white/10 text-sm"
                >
                  <Download className="w-4 h-4" />
                  Export Strategy
                </button>
                <button
                  onClick={handleImport}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-white/80 hover:bg-white/10 text-sm"
                >
                  <Upload className="w-4 h-4" />
                  Import Strategy
                </button>
                <div className="h-px bg-white/10" />
                <button
                  onClick={() => { clearCanvas(); setShowMenu(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-red-400 hover:bg-red-500/20 text-sm"
                >
                  <X className="w-4 h-4" />
                  Clear Canvas
                </button>
              </div>
            )}
          </div>

          <button
            onClick={onOpenCode}
            className="p-2 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            title="View Code (Python/MQL)"
          >
            <Code2 className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenSettings}
            className="p-2 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.strategy.json"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
});

TopToolbar.displayName = 'TopToolbar';
