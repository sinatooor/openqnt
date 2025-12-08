import { useEffect, useRef, useState } from "react";
import * as Blockly from "blockly";
import { environmentBlocksToolbox, operatorBlocksToolbox, controlBlocksToolbox, tradeBlocksToolbox, taBlocksToolbox, myBlocksToolbox } from "@/config/blockly/toolbox";
import { generateCode } from "@/config/blockly/generator";
import { Button } from "@/components/ui/button";
import "@/styles/blockly-custom.css";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Code2, Copy, Check, Download, Upload, ZoomIn, ZoomOut, Maximize2, Undo2, Redo2, Wand2, FileCode, BarChart3, BookOpen, Search, Pencil, TrendingUp, Loader2, History as HistoryIcon } from "lucide-react";
import { toast } from "sonner";
import { BacktestingPanel } from "@/features/backtest/components/BacktestingPanel";
import { StrategyTemplatesDialog } from "@/components/StrategyTemplatesDialog";
import { FloatingChartModal } from "@/components/FloatingChartModal";
import { AIChatPanel } from "@/features/ai/components/AIChatPanel";
import { GuidedTour } from "@/components/GuidedTour";
import { DevLogPanel, LogEntry } from "@/components/DevLogPanel";
import { BlockSearchDialog } from "@/components/BlockSearchDialog";

import { StrategyTemplate } from "@/features/templates/strategyTemplates";
import { cn } from "@/lib/utils";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { fetchMarketData } from "@/services/marketData";
import { BacktestResult, runBacktest } from "@/features/backtest/logic/engine";
import { IndicatorSettingsModal } from "@/components/IndicatorSettingsModal";
import { IGTradingPanel } from "@/components/IGTradingPanel";

interface BlocklyWorkspaceProps {
  runTour?: boolean;
  onTourComplete?: () => void;
  onStepChange?: (stepIndex: number) => void;
  showAIPanelFromParent?: boolean;
  onAIPanelChange?: (show: boolean) => void;
  leverage?: number;
  onXmlChange?: (xml: string | null) => void;
}

export const BlocklyWorkspace = ({
  runTour: runTourProp,
  onTourComplete: onTourCompleteProp,
  onStepChange,
  showAIPanelFromParent,
  onAIPanelChange,
  leverage = 1,
  onXmlChange
}: BlocklyWorkspaceProps = {}) => {
  const blocklyDiv = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const [generatedMqlCode, setGeneratedMqlCode] = useState<string>("");
  const [currentXmlCode, setCurrentXmlCode] = useState<string>("");
  const [codeTab, setCodeTab] = useState<"mql" | "xml">("mql");
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [blockCount, setBlockCount] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isEmpty, setIsEmpty] = useState(true);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [beautified, setBeautified] = useState(true);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [showBacktest, setShowBacktest] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showFloatingChart, setShowFloatingChart] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showIGPanel, setShowIGPanel] = useState(false);
  const [pendingXml, setPendingXml] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [runTour, setRunTour] = useState(runTourProp || false);
  const [isDraggingBlock, setIsDraggingBlock] = useState(false);
  const [draggedBlockData, setDraggedBlockData] = useState<{ xml: string; name: string } | null>(null);
  const aiPanelRef = useRef<HTMLDivElement>(null);
  const [showDevLogs, setShowDevLogs] = useState(() => {
    return localStorage.getItem('showDevLogs') === 'true';
  });
  const [devLogs, setDevLogs] = useState<LogEntry[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [strategyName, setStrategyName] = useState("Untitled Strategy");
  const [isEditingName, setIsEditingName] = useState(false);

  // Advanced Logic Modal State
  const [showAdvancedLogic, setShowAdvancedLogic] = useState(false);
  const [currentLogicBlockId, setCurrentLogicBlockId] = useState<string | null>(null);
  const [currentLogicXml, setCurrentLogicXml] = useState<string>("");
  const [currentIndicatorType, setCurrentIndicatorType] = useState<string>("");

  // Indicator Settings Modal State
  const [showIndicatorSettings, setShowIndicatorSettings] = useState(false);
  const [currentIndicatorBlockId, setCurrentIndicatorBlockId] = useState<string | null>(null);
  const [currentIndicatorName, setCurrentIndicatorName] = useState<string>("");
  const [currentIndicatorParams, setCurrentIndicatorParams] = useState<Record<string, number>>({});

  // Sync with prop changes
  useEffect(() => {
    if (runTourProp !== undefined) {
      setRunTour(runTourProp);
    }
  }, [runTourProp]);

  // Sync AI panel with parent
  useEffect(() => {
    if (showAIPanelFromParent !== undefined) {
      setShowAIPanel(showAIPanelFromParent);
    }
  }, [showAIPanelFromParent]);

  // Notify parent when AI panel changes locally
  useEffect(() => {
    if (onAIPanelChange) {
      onAIPanelChange(showAIPanel);
    }
  }, [showAIPanel, onAIPanelChange]);

  // Dev logs keyboard shortcut
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        const newState = !showDevLogs;
        setShowDevLogs(newState);
        localStorage.setItem('showDevLogs', String(newState));
      }

      // Search shortcut (Cmd+F or Ctrl+F)
      if ((e.metaKey || e.ctrlKey) && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        setShowSearch(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showDevLogs]);

  const handleTourComplete = () => {
    setRunTour(false);
    if (onTourCompleteProp) {
      onTourCompleteProp();
    } else {
      localStorage.setItem("hasSeenGuidedTour", "true");
    }
  };
  const handleStartTour = () => {
    setRunTour(true);
  };
  useEffect(() => {
    if (!blocklyDiv.current) return;

    // Create custom dark theme matching the app design
    const darkTheme = Blockly.Theme.defineTheme("dark", {
      name: "dark",
      base: Blockly.Themes.Classic,
      componentStyles: {
        workspaceBackgroundColour: "#181c23",
        toolboxBackgroundColour: "#1c2028",
        toolboxForegroundColour: "#f8fafc",
        flyoutBackgroundColour: "#1c2028",
        flyoutForegroundColour: "#94a3b8",
        flyoutOpacity: 0.95,
        scrollbarColour: "#25292f",
        scrollbarOpacity: 0.5,
        insertionMarkerColour: "#3b82f6",
        insertionMarkerOpacity: 0.3
      },
      blockStyles: {
        environment_blocks: {
          colourPrimary: "#10b981",
          colourSecondary: "#059669",
          colourTertiary: "#047857"
        },
        operator_blocks: {
          colourPrimary: "#3b82f6",
          colourSecondary: "#2563eb",
          colourTertiary: "#1d4ed8"
        },
        control_blocks: {
          colourPrimary: "#f59e0b",
          colourSecondary: "#d97706",
          colourTertiary: "#b45309"
        },
        trade_blocks: {
          colourPrimary: "#06b6d4",
          colourSecondary: "#0891b2",
          colourTertiary: "#0e7490"
        },
        ta_blocks: {
          colourPrimary: "#8b5cf6",
          colourSecondary: "#7c3aed",
          colourTertiary: "#6d28d9"
        },
        risk_blocks: {
          colourPrimary: "#ec4899",
          colourSecondary: "#db2777",
          colourTertiary: "#be185d"
        },
        mtf_blocks: {
          colourPrimary: "#06b6d4",
          colourSecondary: "#0891b2",
          colourTertiary: "#0e7490"
        },
        variable_blocks: {
          colourPrimary: "#64748b",
          colourSecondary: "#475569",
          colourTertiary: "#334155"
        },
        function_blocks: {
          colourPrimary: "#ef4444",
          colourSecondary: "#dc2626",
          colourTertiary: "#b91c1c"
        }
      }
    });

    // Initialize workspace with configuration
    const workspace = Blockly.inject(blocklyDiv.current, {
      renderer: 'zelos',
      theme: darkTheme,
      toolbox: {
        kind: "categoryToolbox",
        contents: [{
          kind: "category",
          name: "AI",
          colour: "#ec4899",
          custom: "AI_CATEGORY"
        }, {
          kind: "sep"
        }, {
          kind: "category",
          name: "Environment",
          colour: "#10b981",
          contents: environmentBlocksToolbox
        }, {
          kind: "category",
          name: "Control",
          colour: "#f59e0b",
          contents: controlBlocksToolbox
        }, {
          kind: "category",
          name: "Operators",
          colour: "#3b82f6",
          contents: operatorBlocksToolbox
        }, {
          kind: "category",
          name: "TA Tools",
          colour: "#8b5cf6",
          contents: taBlocksToolbox
        }, {
          kind: "category",
          name: "Values",
          colour: "#64748b",
          contents: [{
            kind: "block",
            type: "math_number",
            fields: {
              NUM: 0
            }
          }]
        }, {
          kind: "category",
          name: "Trade",
          colour: "#06b6d4",
          contents: tradeBlocksToolbox
        }, {
          kind: "category",
          name: "My Blocks",
          colour: "#ef4444",
          contents: myBlocksToolbox
        }]
      },
      grid: {
        spacing: 20,
        length: 3,
        colour: "#2a2e35",
        snap: true
      },
      zoom: {
        controls: true,
        wheel: true,
        startScale: 0.9,
        maxScale: 3,
        minScale: 0.3,
        scaleSpeed: 1.2
      },
      trashcan: true,
      move: {
        scrollbars: {
          horizontal: true,
          vertical: true
        },
        drag: true,
        wheel: true
      }
    });
    workspaceRef.current = workspace;

    // Register custom category callback for AI
    workspace.registerToolboxCategoryCallback("AI_CATEGORY", () => {
      setShowAIPanel(prev => !prev);
      return [];
    });

    // Register button callback for MACD settings
    workspace.registerButtonCallback('CONFIG_MACD', () => {
      toast.info('MACD Settings', {
        description: 'Settings modal coming soon! For now, using default periods: 12/26/9'
      });
    });

    // Add drag event listener for blocks to enable dragging to chat
    workspace.addChangeListener((event: any) => {
      if (event.type === Blockly.Events.BLOCK_DRAG) {
        const block = workspace.getBlockById(event.blockId);
        if (event.isStart && block) {
          // Drag started
          const blockXml = Blockly.Xml.blockToDom(block as Blockly.BlockSvg);
          const xmlText = Blockly.Xml.domToText(blockXml);
          const blockName = (block as any).type?.replace(/_/g, ' ') || 'Unknown block';

          setIsDraggingBlock(true);
          setDraggedBlockData({
            xml: xmlText,
            name: blockName
          });
        } else if (!event.isStart) {
          // Drag ended - check if dropped on AI panel
          const aiPanel = aiPanelRef.current;
          if (aiPanel && draggedBlockData) {
            const rect = aiPanel.getBoundingClientRect();
            const mouseX = (event as any).clientX || (window as any).lastMouseX;
            const mouseY = (event as any).clientY || (window as any).lastMouseY;

            // Check if drop position is within AI panel bounds
            if (mouseX >= rect.left && mouseX <= rect.right &&
              mouseY >= rect.top && mouseY <= rect.bottom) {
              // Block was dropped on AI panel - add to chat
              const chatInput = document.querySelector('[data-ai-chat-input]') as HTMLInputElement;
              if (chatInput) {
                // Trigger the add block to chat functionality
                const addBlockEvent = new CustomEvent('addBlockToChat', {
                  detail: draggedBlockData
                });
                window.dispatchEvent(addBlockEvent);

                toast.success(`Block attached: ${draggedBlockData.name}`);
              }
            }
          }

          setIsDraggingBlock(false);
          setDraggedBlockData(null);
        }
      }
    });

    // Track mouse position for drop detection
    const trackMouse = (e: MouseEvent) => {
      (window as any).lastMouseX = e.clientX;
      (window as any).lastMouseY = e.clientY;
    };
    document.addEventListener('mousemove', trackMouse);

    // Listen to workspace changes to update code and stats
    workspace.addChangeListener(() => {
      // Update block count
      const allBlocks = workspace.getAllBlocks(false);
      setBlockCount(allBlocks.length);
      setIsEmpty(allBlocks.length === 0);

      // Update zoom level
      const metrics = workspace.getMetrics();
      if (metrics) {
        const currentZoom = workspace.scale;
        setZoomLevel(Math.round(currentZoom * 100));
      }

      // Generate XML for parent component
      if (allBlocks.length > 0) {
        const xml = Blockly.Xml.workspaceToDom(workspace);
        const xmlText = Blockly.Xml.domToText(xml);
        onXmlChange?.(xmlText);
      } else {
        onXmlChange?.(null);
      }
    });

    // Register global handler for opening advanced logic
    (window as any).openAdvancedLogicModal = (blockId: string, type: string, xml: string) => {
      setCurrentLogicBlockId(blockId);
      setCurrentIndicatorType(type);
      setCurrentLogicXml(xml);
      setShowAdvancedLogic(true);
    };

    // Register global handler for opening indicator settings
    (window as any).openIndicatorSettings = (blockId: string, indicatorName: string) => {
      if (!workspaceRef.current) return;
      const block = workspaceRef.current.getBlockById(blockId) as any;
      if (block) {
        setCurrentIndicatorBlockId(blockId);
        setCurrentIndicatorName(indicatorName);
        setCurrentIndicatorParams(block.indicatorParams || {});
        setShowIndicatorSettings(true);
      }
    };

    // Cleanup on unmount
    return () => {
      document.removeEventListener('mousemove', trackMouse);
      delete (window as any).openAdvancedLogicModal;
      delete (window as any).openIndicatorSettings;
      workspace.dispose();
    };
  }, []);

  // Handle workspace resize when panels open/close
  useEffect(() => {
    if (workspaceRef.current) {
      // Small delay to allow CSS transitions to complete
      const timer = setTimeout(() => {
        Blockly.svgResize(workspaceRef.current!);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showCode, showAIPanel, showDevLogs]);

  // Auto-generate MQL code when Code panel opens or workspace changes
  useEffect(() => {
    if (showCode && workspaceRef.current) {
      const code = generateCode(workspaceRef.current, 'mql', leverage);
      setGeneratedMqlCode(code);

      // Only update XML if we are NOT currently editing it (basic heuristic: if focused? No, hard to track)
      // Or just accept that workspace changes overwrite manual edits until applied.
      // For "Paste & Create", this is fine.

      const xml = Blockly.Xml.workspaceToDom(workspaceRef.current);
      const xmlText = Blockly.Xml.domToText(xml);
      // Format XML for readability
      const formattedXml = xmlText
        .replace(/></g, '>\n<')
        .replace(/(<[^/][^>]*>)/g, '  $1')
        .replace(/(<\/[^>]+>)/g, '$1\n');

      // If we are in XML tab and have pending edits, maybe don't overwrite?
      // For now, let's keep it simple: Workspace is truth.
      // If user pastes, they should click "Create" immediately.
      setCurrentXmlCode(formattedXml);
      onXmlChange?.(formattedXml);
    }
  }, [showCode, blockCount, leverage]);

  const handleCopyCode = () => {
    const codeToCopy = codeTab === "xml" ? currentXmlCode : generatedMqlCode;
    navigator.clipboard.writeText(codeToCopy);
    setCopied(true);
    toast.success(`${codeTab.toUpperCase()} code copied to clipboard!`);
    setTimeout(() => setCopied(false), 2000);
  };



  const handleSaveWorkspace = () => {
    if (!workspaceRef.current) return;
    const xml = Blockly.Xml.workspaceToDom(workspaceRef.current);
    const xmlText = Blockly.Xml.domToText(xml);
    const blob = new Blob([xmlText], {
      type: "application/xml"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "trading-strategy-blocks.xml";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Workspace saved successfully!");
  };
  const handleLoadWorkspace = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xml";
    input.onchange = e => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !workspaceRef.current) return;
      const reader = new FileReader();
      reader.onload = event => {
        try {
          const xmlText = event.target?.result as string;
          const xml = Blockly.utils.xml.textToDom(xmlText);
          workspaceRef.current?.clear();
          Blockly.Xml.domToWorkspace(xml, workspaceRef.current!);
          toast.success("Workspace loaded successfully!");
        } catch (error) {
          toast.error("Failed to load workspace. Invalid file format.");
          console.error(error);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };
  const handleLoadTemplate = (template: StrategyTemplate) => {
    if (!workspaceRef.current) return;
    try {
      const xml = Blockly.utils.xml.textToDom(template.workspace);
      workspaceRef.current.clear();
      Blockly.Xml.domToWorkspace(xml, workspaceRef.current);
      toast.success(`${template.name} template loaded successfully!`, {
        description: template.description,
        duration: 4000
      });
    } catch (error) {
      toast.error("Failed to load template.");
      console.error(error);
    }
  };
  const handleZoom = (direction: "in" | "out" | "reset" | number) => {
    if (!workspaceRef.current) return;
    const workspace = workspaceRef.current;
    const currentZoom = workspace.scale;
    if (typeof direction === "number") {
      workspace.setScale(direction / 100);
    } else if (direction === "in") {
      workspace.setScale(currentZoom * 1.2);
    } else if (direction === "out") {
      workspace.setScale(currentZoom / 1.2);
    } else if (direction === "reset") {
      workspace.setScale(1.0);
      workspace.scrollCenter();
    }
    const newZoom = workspace.scale;
    setZoomLevel(Math.round(newZoom * 100));
  };
  const handleCenterWorkspace = () => {
    if (!workspaceRef.current) return;
    workspaceRef.current.scrollCenter();
    toast.success("Workspace centered");
  };
  const handleUndo = () => {
    if (!workspaceRef.current) return;
    workspaceRef.current.undo(false);
  };
  const handleRedo = () => {
    if (!workspaceRef.current) return;
    workspaceRef.current.undo(true);
  };
  const handlePreviewBacktest = async (engine: 'frontend' | 'backtesting.py' | 'nautilus' = 'frontend') => {
    // Validate workspace has blocks
    if (!workspaceRef.current || isEmpty) {
      toast.error("Add blocks to your workspace first to run a backtest.");
      return;
    }

    // Get workspace XML
    const workspaceXml = getCurrentWorkspaceXml();
    if (!workspaceXml) {
      toast.error("No strategy blocks found. Add blocks to create a strategy.");
      return;
    }

    // Start backtesting
    setIsBacktesting(true);
    setShowBacktest(true);
    const loadingToast = toast.loading(`Running backtest (${engine})...`, {
      description: engine === 'frontend' ? "Simulating in browser..." : "Running on server..."
    });

    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

    try {
      // If frontend engine selected (legacy)
      if (engine === 'frontend') {
        // ... existing frontend logic if needed, or just use backend for everything?
        // For now, let's route EVERYTHING to backend if it's not 'frontend', 
        // but wait, the existing code called backend /backtest which was using the old runner.
        // Now /backtest uses the new service.
        // So 'frontend' option might need to call the frontend engine directly?
        // The previous code called backend /backtest.
        // Let's assume 'frontend' means "Simple/Legacy" which now maps to backend simple parser?
        // No, 'frontend' usually means client-side execution.
        // But the previous code called `fetch(${backendUrl}/backtest`!
        // So the "frontend" engine was actually running on the backend?
        // Let's stick to calling the backend for all engines, just passing the engine param.
      }

      // Create AbortController for timeout (2 minutes for LLM-based backtests)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const response = await fetch(`${backendUrl}/backtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          workspaceXml: workspaceXml,
          symbol: 'EURUSD',
          startDate: '2024-01-01',
          endDate: '2024-03-31',
          initialBalance: 100000,
          tradeSize: 100000,
          engine: engine
        })
      });

      clearTimeout(timeoutId);

      const data = await response.json();
      toast.dismiss(loadingToast);

      if (data.success) {
        // Map backend response to frontend format
        const result = {
          metrics: {
            totalReturn: ((data.final_balance - data.initial_balance) / data.initial_balance) * 100,
            winRate: data.metrics.win_rate,
            maxDrawdown: data.metrics.max_drawdown,
            sharpeRatio: data.metrics.sharpe_ratio || 0,
            totalTrades: data.metrics.total_trades,
            winningTrades: data.metrics.winning_trades,
            losingTrades: data.metrics.losing_trades,
            profitableTrades: data.metrics.winning_trades,
            averageWin: data.metrics.avg_win || 0,
            averageLoss: data.metrics.avg_loss || 0,
            profitFactor: data.metrics.profit_factor || 1,
          },
          trades: data.trades.map((t: any) => ({
            type: t.side,
            date: t.entry_time,
            price: t.entry_price,
            exitDate: t.exit_time,
            exitPrice: t.exit_price,
            profit: t.profit_loss
          })),
          equityCurve: data.equity_curve.map((point: any) => ({
            date: point.timestamp,
            value: point.equity
          })),
          chartData: data.equity_curve.map((point: any) => ({
            date: point.timestamp,
            equity: point.equity
          }))
        };

        setBacktestResult(result);

        const isProfit = result.metrics.totalReturn >= 0;
        toast.success(isProfit ? "🎉 Backtest completed!" : "Backtest completed", {
          description: `${isProfit ? "📈" : "📉"} Return: ${result.metrics.totalReturn.toFixed(2)}% | Win Rate: ${result.metrics.winRate.toFixed(1)}% | ${result.metrics.totalTrades} trades`,
          duration: 5000
        });
      } else {
        toast.error("Backtest failed", {
          description: data.error || "Check your strategy and try again"
        });
        setShowBacktest(false);
      }
    } catch (error: any) {
      console.error("Backtest error:", error);
      toast.dismiss(loadingToast);
      
      let errorMessage = "Backend not running? Start with: cd backend && uvicorn main:app --port 8000";
      if (error.name === 'AbortError') {
        errorMessage = "Request timed out. The backtest is taking too long - try with a shorter date range.";
      } else if (error.message?.includes('Failed to fetch')) {
        errorMessage = "Cannot connect to backend. Make sure the server is running on port 8000.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error("Backtest failed", {
        description: errorMessage
      });
      setShowBacktest(false);
    } finally {
      setIsBacktesting(false);
    }
  };
  const handleBlocksGenerated = (xml: string, isEdit: boolean = false) => {
    if (!workspaceRef.current) return;
    const hasBlocks = workspaceRef.current.getAllBlocks(false).length > 0;
    if (!hasBlocks || isEdit) {
      // Workspace is empty or this is an edit - replace/add blocks directly
      loadXmlToWorkspace(xml, isEdit);
      toast.success(isEdit ? "Strategy Updated" : "Strategy Added", {
        description: isEdit ? "Your blocks have been updated with the changes." : "AI-generated blocks have been added to your workspace."
      });
    } else {
      // Workspace has blocks, ask user first
      setPendingXml(xml);
      setShowConfirmDialog(true);
    }
  };
  const getCurrentWorkspaceXml = (): string | null => {
    if (!workspaceRef.current) return null;
    const allBlocks = workspaceRef.current.getAllBlocks(false);
    if (allBlocks.length === 0) return null;
    const xml = Blockly.Xml.workspaceToDom(workspaceRef.current);
    return Blockly.Xml.domToText(xml);
  };
  const getSelectedBlocksXml = (): {
    xml: string;
    name: string;
  } | null => {
    if (!workspaceRef.current) return null;
    const selected = Blockly.common.getSelected();
    if (!selected) return null;
    const block = selected as Blockly.BlockSvg;
    const blockXml = Blockly.Xml.blockToDom(block);
    const xmlText = Blockly.Xml.domToText(blockXml);
    const blockName = (block as any).type?.replace(/_/g, ' ') || 'Unknown block';
    return {
      xml: xmlText,
      name: blockName
    };
  };
  const loadXmlToWorkspace = (xml: string, clearFirst: boolean = false) => {
    if (!workspaceRef.current) return;
    try {
      // Extract XML content if it's wrapped in markdown code blocks or surrounded by text
      let cleanXml = xml.trim();

      // Remove markdown code blocks
      if (cleanXml.includes('```xml')) {
        cleanXml = cleanXml.replace(/```xml\n?/g, '').replace(/```/g, '').trim();
      }

      // Extract XML using regex (in case AI added explanation text before/after)
      const xmlMatch = cleanXml.match(/<xml[^>]*>[\s\S]*<\/xml>/i);
      if (xmlMatch) {
        cleanXml = xmlMatch[0];
      }

      // Validate XML format
      if (!cleanXml.startsWith('<xml')) {
        console.error("Invalid XML format - doesn't start with <xml>:", cleanXml.substring(0, 100));
        toast.error("Invalid XML format", {
          description: "The generated blocks are not in the correct format. Please try again."
        });
        return;
      }
      if (!cleanXml.includes('</xml>')) {
        console.error("Invalid XML format - missing closing tag:", cleanXml.substring(0, 100));
        toast.error("Incomplete XML", {
          description: "The generated blocks are incomplete. Please try again."
        });
        return;
      }

      // CRITICAL: Validate XML can be parsed BEFORE clearing workspace
      const xmlDom = Blockly.utils.xml.textToDom(cleanXml);

      // Only clear workspace AFTER validation succeeds
      if (clearFirst) {
        workspaceRef.current.clear();
      }

      // Now load the already-validated XML
      Blockly.Xml.domToWorkspace(xmlDom, workspaceRef.current);
      const allBlocks = workspaceRef.current.getAllBlocks(false);
      setIsEmpty(allBlocks.length === 0);
      setBlockCount(allBlocks.length);
    } catch (error) {
      // DON'T clear workspace if we got here - preserves existing blocks
      console.error("Error loading XML:", error);
      console.error("Failed XML content:", xml.substring(0, 500));

      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // More specific error messages
      let description = "Could not load the generated blocks. Your existing workspace was preserved.";
      if (errorMessage.includes("doesn't exist")) {
        description = `Block structure error: ${errorMessage}. This may be due to incompatible block connections. Your workspace was preserved.`;
      } else if (errorMessage.includes("XML")) {
        description = "The generated blocks have invalid XML format. Your workspace was preserved.";
      }

      toast.error("Failed to load blocks", { description });
    }
  };
  const handleConfirmAdd = () => {
    if (pendingXml) {
      loadXmlToWorkspace(pendingXml);
      setPendingXml(null);
      toast.success("Strategy Added", {
        description: "AI-generated blocks have been added to your workspace."
      });
    }
    setShowConfirmDialog(false);
  };
  const handleCancelAdd = () => {
    setPendingXml(null);
    setShowConfirmDialog(false);
  };
  const handleCloseBacktest = () => {
    setShowBacktest(false);
    setBacktestResult(null);
  };
  const beautifyCode = (code: string): string => {
    if (!code) return code;
    let result = "";
    let indent = 0;
    const lines = code.split("\n");
    for (let line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Check if line starts with closing brace to decrease indent BEFORE adding line
      if (trimmed.startsWith("}") || trimmed.startsWith("];") || trimmed.startsWith(");")) {
        indent = Math.max(0, indent - 1);
      }

      // Add indentation
      result += "    ".repeat(indent) + trimmed + "\n"; // Use 4 spaces for better readability

      // Check if line ends with opening brace to increase indent AFTER adding line
      // Also handle case statements
      if (trimmed.endsWith("{") || trimmed.endsWith("(") || trimmed.endsWith("[") || trimmed.endsWith(":") && !trimmed.includes("default:")) {
        indent++;
      }

      // Special handling for 'default:' to align with cases but indent content
      if (trimmed === "default:") {
        // Usually case/default are at same level as switch, content indented
        // But simple logic: if it ends in :, indent next line
        indent++;
      }
    }
    return result;
  };
  const getCodeStatistics = () => {
    if (!generatedMqlCode) return {
      lines: 0,
      chars: 0,
      complexity: 0
    };
    const lines = generatedMqlCode.split("\n").filter(line => line.trim()).length;
    const chars = generatedMqlCode.length;

    // Simple complexity estimation based on control structures
    const ifCount = (generatedMqlCode.match(/if\s*\(/g) || []).length;
    const loopCount = (generatedMqlCode.match(/while\s*\(|for\s*\(/g) || []).length;
    const complexity = ifCount + loopCount * 2 + Math.floor(blockCount / 5);
    return {
      lines,
      chars,
      complexity
    };
  };
  const renderCodeWithLineNumbers = (code: string) => {
    if (!code) {
      return <div className="text-muted-foreground italic">
          // No blocks yet
        <br />
          // Drag blocks from the toolbox to start building your strategy
      </div>;
    }
    const displayCode = beautified ? beautifyCode(code) : code;
    const lines = displayCode.split("\n");
    return <div className="flex font-mono text-sm">
      {showLineNumbers && <div className="select-none pr-4 text-[#858585] text-right border-r border-[#404040] min-w-[3rem]">
        {lines.map((_, i) => <div key={i} className="leading-6">
          {i + 1}
        </div>)}
      </div>}
      <div className="flex-1 pl-4">
        {lines.map((line, i) => <div key={i} className="leading-6">
          <code className="syntax-highlight whitespace-pre">{highlightSyntax(line)}</code>
        </div>)}
      </div>
    </div>;
  };

  const handleLog = (log: LogEntry) => {
    setDevLogs(prev => {
      const newLogs = [...prev, log];
      return newLogs.slice(-100);
    });
  };

  const handleClearLogs = () => {
    setDevLogs([]);
  };

  const handleCloseLogs = () => {
    setShowDevLogs(false);
    localStorage.setItem('showDevLogs', 'false');
  };

  const handleSaveAdvancedLogic = (xml: string) => {
    if (!workspaceRef.current || !currentLogicBlockId) return;

    const block = workspaceRef.current.getBlockById(currentLogicBlockId);
    if (block) {
      // Update the hidden field with the new XML
      block.setFieldValue(xml, 'ADVANCED_LOGIC_XML');

      // Optional: Visual feedback on the block that logic is active
      if (xml && xml.trim() !== "") {
        // You could change block color or add an icon here if supported
        // For now, we rely on the field value
      }

      toast.success("Advanced logic saved for this block");
    }
  };

  const handleSaveIndicatorSettings = (params: Record<string, number>) => {
    if (!workspaceRef.current || !currentIndicatorBlockId) return;

    const block = workspaceRef.current.getBlockById(currentIndicatorBlockId) as any;
    if (block) {
      block.indicatorParams = params;
      // Trigger mutation update
      const mutation = block.mutationToDom();
      if (mutation) {
        Blockly.Events.fire(new Blockly.Events.BlockChange(block, 'mutation', null, '', Blockly.utils.xml.domToText(mutation)));
      }
      toast.success("Indicator settings saved");
    }
  };

  const handleAddBlock = (type: string) => {
    if (!workspaceRef.current) return;

    const workspace = workspaceRef.current;
    const block = workspace.newBlock(type);
    block.initSvg();
    block.render();

    // Center the block in the view
    const metrics = workspace.getMetrics();
    if (metrics) {
      const x = metrics.viewLeft + metrics.viewWidth / 2 - block.getHeightWidth().width / 2;
      const y = metrics.viewTop + metrics.viewHeight / 2 - block.getHeightWidth().height / 2;
      block.moveBy(x, y);
    }

    // Select the new block
    block.select();

    toast.success(`Added ${type.replace(/_/g, ' ')} block`);
  };

  const highlightSyntax = (line: string) => {
    if (!line.trim()) return " ";

    // Simple syntax highlighting for MQL5
    const keywords = [
      "if", "else", "while", "for", "do", "break", "continue", "return", "switch", "case", "default",
      "void", "int", "double", "bool", "string", "datetime", "ulong", "uint", "char", "short", "long", "float",
      "class", "struct", "enum", "input", "const", "static", "virtual", "override", "public", "private", "protected",
      "true", "false", "new", "delete", "operator", "this", "input", "sinput"
    ];
    const parts: JSX.Element[] = [];
    let remaining = line;
    let key = 0;

    // Handle comments
    if (line.trim().startsWith("//")) {
      return <span className="syntax-comment">{line}</span>;
    }

    // Simple tokenization
    const tokens = remaining.split(/(\s+|[{}();,\[\]])/);
    tokens.forEach(token => {
      if (keywords.includes(token)) {
        parts.push(<span key={key++} className="syntax-keyword">
          {token}
        </span>);
      } else if (token.match(/^['"].*['"]$/)) {
        parts.push(<span key={key++} className="syntax-string">
          {token}
        </span>);
      } else if (token.match(/^\d+(\.\d+)?$/)) {
        parts.push(<span key={key++} className="syntax-number">
          {token}
        </span>);
      } else if (token.match(/^[{}();,\[\]]$/)) {
        parts.push(<span key={key++} className="syntax-punctuation">
          {token}
        </span>);
      } else if (token.match(/^[A-Z][a-zA-Z0-9_]*$/) && !keywords.includes(token)) {
        // Capitalized words are likely types or classes
        parts.push(<span key={key++} className="syntax-type">
          {token}
        </span>);
      } else if (token.match(/^[a-zA-Z_][a-zA-Z0-9_]*(?=\()/) || (remaining.includes(token + '(') && !keywords.includes(token))) {
        // Words followed by ( are likely functions - this is a rough heuristic
        parts.push(<span key={key++} className="syntax-function">
          {token}
        </span>);
      } else if (token.match(/^[+\-*/%=&|<>!^]+$/)) {
        parts.push(<span key={key++} className="syntax-operator">
          {token}
        </span>);
      } else if (token.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
        // Variables/Identifiers - default color
        parts.push(<span key={key++} className="syntax-variable">
          {token}
        </span>);
      } else {
        parts.push(<span key={key++}>{token}</span>);
      }
    });
    return <>{parts}</>;
  };
  return <div className="flex-1 h-full relative flex flex-col">
    {/* Action Bar */}
    <div className="h-14 bg-card border-b border-border flex items-center justify-between px-4 gap-3">
      <div className="flex items-center gap-3">
        {isEditingName ? (
          <input
            type="text"
            value={strategyName}
            onChange={(e) => setStrategyName(e.target.value)}
            onBlur={() => setIsEditingName(false)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setIsEditingName(false);
            }}
            autoFocus
            className="h-8 px-2 py-1 text-lg font-semibold bg-transparent border-b-2 border-primary focus:outline-none w-[200px]"
          />
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200 group"
                onClick={() => setIsEditingName(true)}
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
            <Button variant="outline" size="sm" onClick={handleSaveWorkspace} className="save-workspace-trigger hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200">
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
            <Button variant="outline" size="sm" onClick={handleLoadWorkspace} className="hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200">
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
            <Button variant="outline" size="sm" onClick={() => setShowTemplates(true)} className="hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200">
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
          onClick={() => setShowSearch(true)}
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
            <Button variant="outline" size="sm" onClick={() => setShowFloatingChart(!showFloatingChart)} className="transition-all duration-200 shadow-indigo hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)]">
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
            <Button variant="outline" size="sm" onClick={handleUndo} className="hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200">
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
            <Button variant="outline" size="sm" onClick={handleRedo} className="hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200">
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
            <Button variant="outline" size="sm" onClick={handleCenterWorkspace} className="hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)] transition-all duration-200">
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
            <Button variant="outline" size="sm" onClick={() => setShowCode(!showCode)} className="transition-all duration-200 hover:shadow-[0_0_0_2px_rgba(59,130,246,0.5)]">
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
              onClick={() => setShowIGPanel(!showIGPanel)}
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
      </div>
    </div>

    {/* Main Content Area */}
    <div className="flex-1 flex min-h-0 relative">
      {/* Blockly Workspace */}
      <div className="flex-1 relative group">
        <div ref={blocklyDiv} className="absolute inset-0" />

        {/* Empty State Overlay */}
        {isEmpty && <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center space-y-4 opacity-0 animate-in fade-in zoom-in duration-500 delay-150 fill-mode-forwards">
            <div className="bg-card/50 backdrop-blur-sm p-8 rounded-2xl border border-border/50 shadow-2xl">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Wand2 className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold">Start Building</h3>
              <p className="text-muted-foreground max-w-sm">
                Drag blocks from the toolbox or ask AI to generate a strategy for you.
              </p>
            </div>
          </div>
        </div>}
      </div>

      {/* Code View Panel */}
      {showCode && <div className="w-[500px] h-full border-l border-[#3e3e42] bg-[#1e1e1e] flex flex-col animate-in slide-in-from-right duration-300">
        <div className="h-12 border-b border-[#3e3e42] flex items-center justify-between px-4 bg-[#252526]">
          <div className="flex items-center gap-1">
            {/* Tab Buttons */}
            <button
              onClick={() => setCodeTab("mql")}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                codeTab === "mql"
                  ? "bg-primary/20 text-primary"
                  : "text-gray-400 hover:text-gray-200 hover:bg-[#3e3e42]"
              )}
            >
              MQL5
            </button>
            <button
              onClick={() => setCodeTab("xml")}
              className={cn(
                "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                codeTab === "xml"
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "text-gray-400 hover:text-gray-200 hover:bg-[#3e3e42]"
              )}
            >
              XML
            </button>
          </div>
          <div className="flex items-center gap-1">
            {codeTab === "mql" && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setBeautified(!beautified)}>
                      <Wand2 className={`w-3 h-3 ${beautified ? "text-primary" : ""}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Format Code</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowLineNumbers(!showLineNumbers)}>
                      <span className="text-xs font-mono">#</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Toggle line numbers</TooltipContent>
                </Tooltip>
              </>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopyCode}>
                  {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy to clipboard</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="flex-1 flex flex-col min-h-0 relative bg-[#1e1e1e] text-gray-300">
          <div className="flex-1 flex flex-col min-h-0 p-4">
            {codeTab === "mql" ? (
              <div className="flex-1 overflow-auto custom-scrollbar">
                {renderCodeWithLineNumbers(generatedMqlCode)}
              </div>
            ) : (
              <textarea
                value={currentXmlCode || ""}
                onChange={(e) => {
                  setCurrentXmlCode(e.target.value);
                  // Note: We don't automatically update workspace on typing 
                  // to prevent breaking invalid XML while typing.
                  // User must click "Create Blocks" to apply changes.
                }}
                className="w-full h-full flex-1 font-mono text-sm bg-transparent text-emerald-300 resize-none focus:outline-none p-2 border border-dashed border-[#3e3e42] rounded-md focus:border-emerald-500/50 transition-colors"
                spellCheck={false}
                placeholder="<!-- Paste Blockly XML here and click 'Create Blocks' -->"
              />
            )}
          </div>
        </div>
        <div className="h-10 border-t border-[#3e3e42] flex items-center justify-between px-4 bg-[#252526] text-xs text-gray-400">
          <div className="flex gap-3">
            {codeTab === "mql" ? (
              <>
                <span>{getCodeStatistics().lines} lines</span>
                <span>{getCodeStatistics().chars} chars</span>
              </>
            ) : (
              <>
                <span>{codeTab === "xml"
                  ? (currentXmlCode.match(/\n/g) || []).length + 1
                  : currentXmlCode.split('\n').length} lines</span>
                <span>{currentXmlCode.length} chars</span>
              </>
            )}
          </div>
          <div className="flex gap-2">
            {codeTab === "xml" && (
              <Button
                variant="default"
                size="sm"
                className="h-6 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => {
                  if (!currentXmlCode) {
                    toast.error("No XML code to load");
                    return;
                  }
                  // Force load the XML, replacing existing blocks as it's a direct edit action
                  handleBlocksGenerated(currentXmlCode, true);
                  // handleBlocksGenerated handles parsing and toast notifications
                }}
              >
                <Upload className="w-3 h-3 mr-1" />
                Create Blocks
              </Button>
            )}
            <div>
              {codeTab === "mql" ? `Complexity: ${getCodeStatistics().complexity}` : "Live Edit"}
            </div>
          </div>
        </div>
      </div>}

      {/* AI Chat Panel */}
      {showAIPanel && <div className="w-[400px] border-l border-border bg-card flex flex-col animate-in slide-in-from-right duration-300 shadow-2xl z-10">
        <div className="h-12 border-b border-border flex items-center justify-between px-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-primary" />
            <span className="font-medium text-sm">AI Assistant</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowAIPanel(false)}>
            <span className="sr-only">Close</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
          </Button>
        </div>
        <div className="flex-1 overflow-auto" ref={aiPanelRef}>
          <AIChatPanel
            onBlocksGenerated={handleBlocksGenerated}
            getCurrentWorkspaceXml={getCurrentWorkspaceXml}
            getSelectedBlocksXml={getSelectedBlocksXml}
            onLog={handleLog}
          />
        </div>
      </div>}

      {/* Backtesting Panel */}
      <BacktestingPanel
        result={backtestResult}
        isLoading={isBacktesting}
        symbol="EURUSD"
        onClose={() => {
          setShowBacktest(false);
          setBacktestResult(null);
        }}
        onRunBacktest={handlePreviewBacktest}
      />

      {/* IG Trading Panel */}
      {showIGPanel && (
        <IGTradingPanel
          onClose={() => setShowIGPanel(false)}
          getWorkspaceXml={() => currentXmlCode || null}
        />
      )}
    </div>

    {/* Strategy Templates Dialog */}
    <StrategyTemplatesDialog open={showTemplates} onOpenChange={setShowTemplates} onLoadTemplate={handleLoadTemplate} />

    {/* Floating Chart Modal */}
    <FloatingChartModal isOpen={showFloatingChart} onClose={() => setShowFloatingChart(false)} symbol="BTC/USDT" interval="1D" />


    {/* Dev Logs Panel */}
    {showDevLogs && (
      <DevLogPanel
        logs={devLogs}
        onClear={handleClearLogs}
        onClose={handleCloseLogs}
      />
    )}

    {/* Confirmation Dialog for Adding AI Blocks */}
    <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Add AI-Generated Blocks?</AlertDialogTitle>
          <AlertDialogDescription>
            Your workspace already contains blocks. Do you want to add the AI-generated strategy blocks to your existing workspace?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancelAdd}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmAdd}>Add Blocks</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    {/* Guided Tour */}
    <GuidedTour
      run={runTour}
      onComplete={handleTourComplete}
      onStepChange={onStepChange}
    />

    {/* Indicator Settings Modal */}
    <IndicatorSettingsModal
      open={showIndicatorSettings}
      onOpenChange={setShowIndicatorSettings}
      indicatorName={currentIndicatorName}
      currentParams={currentIndicatorParams}
      onSave={handleSaveIndicatorSettings}
    />

    {/* Search Dialog */}
    <BlockSearchDialog
      open={showSearch}
      onOpenChange={setShowSearch}
      onSelectBlock={handleAddBlock}
    />
  </div>;
};