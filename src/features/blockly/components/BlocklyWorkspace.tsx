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
import { Code2, Copy, Check, Download, Play, Upload, ZoomIn, ZoomOut, Maximize2, RotateCcw, Undo2, Redo2, Blocks, Wand2, FileCode, BarChart3, TrendingUp, BookOpen, Search, Pencil, RefreshCw } from "lucide-react";
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

// Utility imports
import { beautifyCode, getCodeStatistics } from "@/features/blockly/utils/codeFormatting";
import { renderCodeWithLineNumbers } from "@/features/blockly/utils/codeDisplay";

// Hook imports
import { useBlocklyState } from "@/features/blockly/hooks/useBlocklyState";
import { usePanelVisibility } from "@/features/blockly/hooks/usePanelVisibility";
import { useTourState } from "@/features/blockly/hooks/useTourState";
import { useModalState } from "@/features/blockly/hooks/useModalState";

// Component imports
import { WorkspaceToolbar } from "@/features/blockly/components/workspace/WorkspaceToolbar";
import { useWorkspaceHandlers } from "@/features/blockly/hooks/useWorkspaceHandlers";
import { useCodeHandlers } from "@/features/blockly/hooks/useCodeHandlers";
import { useZoomHandlers } from "@/features/blockly/hooks/useZoomHandlers";
import { useBacktestHandlers } from "@/features/blockly/hooks/useBacktestHandlers";

interface BlocklyWorkspaceProps {
  runTour?: boolean;
  onTourComplete?: () => void;
  onStepChange?: (stepIndex: number) => void;
  showAIPanelFromParent?: boolean;
  onAIPanelChange?: (show: boolean) => void;
}

export const BlocklyWorkspace = ({
  runTour: runTourProp,
  onTourComplete: onTourCompleteProp,
  onStepChange,
  showAIPanelFromParent,
  onAIPanelChange
}: BlocklyWorkspaceProps = {}) => {
  // Custom hooks for state management
  const blocklyState = useBlocklyState();
  const panels = usePanelVisibility({ showAIPanelFromParent, onAIPanelChange });
  const tour = useTourState({ runTour: runTourProp, onTourComplete: onTourCompleteProp });
  const modals = useModalState();

  // Destructure for convenience
  const {
    blocklyDiv,
    workspaceRef,
    aiPanelRef,
    generatedCode,
    setGeneratedCode,
    generatedMqlCode,
    setGeneratedMqlCode,
    blockCount,
    setBlockCount,
    isEmpty,
    setIsEmpty,
    zoomLevel,
    setZoomLevel,
    showLineNumbers,
    setShowLineNumbers,
    beautified,
    setBeautified,
    copied,
    setCopied,
    isBacktesting,
    setIsBacktesting,
    strategyName,
    setStrategyName,
    isEditingName,
    setIsEditingName,
    isDraggingBlock,
    setIsDraggingBlock,
    draggedBlockData,
    setDraggedBlockData,
    devLogs,
    setDevLogs,
    pendingXml,
    setPendingXml,
  } = blocklyState;

  const {
    showCode,
    setShowCode,
    showBacktest,
    setShowBacktest,
    showTemplates,
    setShowTemplates,
    showFloatingChart,
    setShowFloatingChart,
    showAIPanel,
    setShowAIPanel,
    showConfirmDialog,
    setShowConfirmDialog,
    showDevLogs,
    setShowDevLogs,
    showSearch,
    setShowSearch,
    showAdvancedLogic,
    setShowAdvancedLogic,
    showIndicatorSettings,
    setShowIndicatorSettings,
  } = panels;

  const { runTour, handleTourComplete, handleStartTour } = tour;

  const {
    currentLogicBlockId,
    setCurrentLogicBlockId,
    currentLogicXml,
    setCurrentLogicXml,
    currentIndicatorType,
    setCurrentIndicatorType,
    currentIndicatorBlockId,
    setCurrentIndicatorBlockId,
    currentIndicatorName,
    setCurrentIndicatorName,
    currentIndicatorParams,
    setCurrentIndicatorParams,
    backtestResult,
    setBacktestResult,
  } = modals;

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
  }, [showDevLogs, setShowDevLogs, setShowSearch]);

  // Handler hooks
  const workspaceHandlers = useWorkspaceHandlers({ workspaceRef });
  const codeHandlers = useCodeHandlers({ generatedCode, setCopied });
  const zoomHandlers = useZoomHandlers({ workspaceRef, setZoomLevel });
  const backtestHandlers = useBacktestHandlers({
    workspaceRef,
    isEmpty,
    generatedCode,
    setIsBacktesting,
    setShowBacktest,
    setBacktestResult,
  });

  // Destructure handlers
  const { handleSaveWorkspace, handleLoadWorkspace, handleLoadTemplate, handleUndo, handleRedo, handleCenterWorkspace } = workspaceHandlers;
  const { handleCopyCode, handleExportCode, handleRunStrategy } = codeHandlers;
  const { handleZoom } = zoomHandlers;
  const { handlePreviewBacktest, handleCloseBacktest } = backtestHandlers;

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
      const code = generateCode(workspaceRef.current, 'mql');
      setGeneratedMqlCode(code);
    }
  }, [showCode, blockCount]);


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


  return <div className="flex-1 h-full relative flex flex-col">
    {/* Action Bar */}
    <WorkspaceToolbar
      strategyName={strategyName}
      isEditingName={isEditingName}
      onStrategyNameChange={setStrategyName}
      onEditingNameChange={setIsEditingName}
      onSaveWorkspace={handleSaveWorkspace}
      onLoadWorkspace={handleLoadWorkspace}
      onShowTemplates={() => setShowTemplates(true)}
      onShowSearch={() => setShowSearch(true)}
      showFloatingChart={showFloatingChart}
      onToggleFloatingChart={() => setShowFloatingChart(!showFloatingChart)}
      onUndo={handleUndo}
      onRedo={handleRedo}
      zoomLevel={zoomLevel}
      onZoom={handleZoom}
      onCenterWorkspace={handleCenterWorkspace}
      showCode={showCode}
      onToggleCode={() => setShowCode(!showCode)}
    />

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
      {showCode && <div className="w-[500px] border-l border-border bg-card flex flex-col animate-in slide-in-from-right duration-300">
        <div className="h-12 border-b border-border flex items-center justify-between px-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">MQL4 Expert Advisor</span>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowLineNumbers(!showLineNumbers)}>
                  <span className="text-xs font-mono">#</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle line numbers</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopyCode}>
                  {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy to clipboard</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleExportCode}>
                  <Download className="w-3 h-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download .mq4 file</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="flex-1 overflow-auto custom-scrollbar relative bg-muted/20">
          <pre className="p-4 text-sm font-mono leading-relaxed">
            <code className="text-foreground">
              {generatedMqlCode || '// Add blocks to your workspace to generate MQL4 code'}
            </code>
          </pre>
        </div>
        <div className="h-10 border-t border-border flex items-center justify-between px-4 bg-muted/30 text-xs text-muted-foreground">
          <div className="flex gap-3">
            <span>{getCodeStatistics(generatedCode, blockCount).lines} lines</span>
            <span>{getCodeStatistics(generatedCode, blockCount).chars} chars</span>
          </div>
          <div>
            Complexity: {getCodeStatistics(generatedCode, blockCount).complexity}
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