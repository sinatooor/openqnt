import { useEffect, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import {
  environmentBlocksToolbox,
  operatorBlocksToolbox,
  controlBlocksToolbox,
  tradeBlocksToolbox,
  taBlocksToolbox,
} from '@/blockly/blocks';
import { generateCode } from '@/blockly/generators/javascript';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Code2, Copy, Check, Download, Play, Upload, ZoomIn, ZoomOut, Maximize2, RotateCcw, Undo2, Redo2, Blocks } from 'lucide-react';
import { toast } from 'sonner';

export const BlocklyWorkspace = () => {
  const blocklyDiv = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [blockCount, setBlockCount] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    if (!blocklyDiv.current) return;

    // Create custom dark theme matching the app design
    const darkTheme = Blockly.Theme.defineTheme('dark', {
      name: 'dark',
      base: Blockly.Themes.Classic,
      componentStyles: {
        workspaceBackgroundColour: 'hsl(var(--background))',
        toolboxBackgroundColour: 'hsl(var(--card))',
        toolboxForegroundColour: 'hsl(var(--foreground))',
        flyoutBackgroundColour: 'hsl(var(--card))',
        flyoutForegroundColour: 'hsl(var(--muted-foreground))',
        flyoutOpacity: 0.95,
        scrollbarColour: 'hsl(var(--muted))',
        scrollbarOpacity: 0.5,
        insertionMarkerColour: 'hsl(var(--primary))',
        insertionMarkerOpacity: 0.3,
      },
      blockStyles: {
        environment_blocks: {
          colourPrimary: '#10b981',
          colourSecondary: '#059669',
          colourTertiary: '#047857',
        },
        operator_blocks: {
          colourPrimary: '#3b82f6',
          colourSecondary: '#2563eb',
          colourTertiary: '#1d4ed8',
        },
        control_blocks: {
          colourPrimary: '#f59e0b',
          colourSecondary: '#d97706',
          colourTertiary: '#b45309',
        },
        trade_blocks: {
          colourPrimary: '#ef4444',
          colourSecondary: '#dc2626',
          colourTertiary: '#b91c1c',
        },
        ta_blocks: {
          colourPrimary: '#8b5cf6',
          colourSecondary: '#7c3aed',
          colourTertiary: '#6d28d9',
        },
      },
    });

    // Initialize workspace with configuration
    const workspace = Blockly.inject(blocklyDiv.current, {
      theme: darkTheme,
      toolbox: {
        kind: 'categoryToolbox',
        contents: [
          {
            kind: 'category',
            name: 'Environment',
            colour: '#10b981',
            contents: [
              {
                kind: 'label',
                text: 'Market Data',
              },
              ...environmentBlocksToolbox,
            ],
          },
          {
            kind: 'category',
            name: 'Operators',
            colour: '#3b82f6',
            contents: [
              {
                kind: 'label',
                text: 'Comparisons & Math',
              },
              ...operatorBlocksToolbox,
            ],
          },
          {
            kind: 'category',
            name: 'Control',
            colour: '#f59e0b',
            contents: [
              {
                kind: 'label',
                text: 'Logic & Loops',
              },
              ...controlBlocksToolbox,
            ],
          },
          {
            kind: 'category',
            name: 'Trade',
            colour: '#ef4444',
            contents: [
              {
                kind: 'label',
                text: 'Order Actions',
              },
              ...tradeBlocksToolbox,
            ],
          },
          {
            kind: 'category',
            name: 'TA Tools',
            colour: '#8b5cf6',
            contents: [
              {
                kind: 'label',
                text: 'Technical Indicators',
              },
              ...taBlocksToolbox,
            ],
          },
        ],
      },
      grid: {
        spacing: 20,
        length: 3,
        colour: 'hsl(var(--border))',
        snap: true,
      },
      zoom: {
        controls: true,
        wheel: true,
        startScale: 1.0,
        maxScale: 3,
        minScale: 0.3,
        scaleSpeed: 1.2,
      },
      trashcan: true,
      move: {
        scrollbars: {
          horizontal: true,
          vertical: true,
        },
        drag: true,
        wheel: true,
      },
    });

    workspaceRef.current = workspace;

    // Listen to workspace changes to update code and stats
    workspace.addChangeListener(() => {
      const code = generateCode(workspace);
      setGeneratedCode(code);
      
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

    // Cleanup on unmount
    return () => {
      workspace.dispose();
    };
  }, []);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    toast.success('Code copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCode = () => {
    if (!generatedCode) {
      toast.error('No code to export. Add blocks to your workspace first.');
      return;
    }

    const blob = new Blob([generatedCode], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trading-strategy.js';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Strategy exported successfully!');
  };

  const handleRunStrategy = () => {
    if (!generatedCode) {
      toast.error('No strategy to run. Add blocks to your workspace first.');
      return;
    }

    toast.info('Strategy execution would run here. Connect to a trading platform to execute live.');
    console.log('Generated Strategy Code:\n', generatedCode);
  };

  const handleSaveWorkspace = () => {
    if (!workspaceRef.current) return;
    
    const xml = Blockly.Xml.workspaceToDom(workspaceRef.current);
    const xmlText = Blockly.Xml.domToText(xml);
    
    const blob = new Blob([xmlText], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trading-strategy-blocks.xml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Workspace saved successfully!');
  };

  const handleLoadWorkspace = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xml';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !workspaceRef.current) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const xmlText = event.target?.result as string;
          const xml = Blockly.utils.xml.textToDom(xmlText);
          workspaceRef.current?.clear();
          Blockly.Xml.domToWorkspace(xml, workspaceRef.current!);
          toast.success('Workspace loaded successfully!');
        } catch (error) {
          toast.error('Failed to load workspace. Invalid file format.');
          console.error(error);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleZoom = (direction: 'in' | 'out' | 'reset' | number) => {
    if (!workspaceRef.current) return;
    
    const workspace = workspaceRef.current;
    const currentZoom = workspace.scale;
    
    if (typeof direction === 'number') {
      workspace.setScale(direction / 100);
    } else if (direction === 'in') {
      workspace.setScale(currentZoom * 1.2);
    } else if (direction === 'out') {
      workspace.setScale(currentZoom / 1.2);
    } else if (direction === 'reset') {
      workspace.setScale(1.0);
      workspace.scrollCenter();
    }
    
    const newZoom = workspace.scale;
    setZoomLevel(Math.round(newZoom * 100));
  };

  const handleCenterWorkspace = () => {
    if (!workspaceRef.current) return;
    workspaceRef.current.scrollCenter();
    toast.success('Workspace centered');
  };

  const handleUndo = () => {
    if (!workspaceRef.current) return;
    workspaceRef.current.undo(false);
  };

  const handleRedo = () => {
    if (!workspaceRef.current) return;
    workspaceRef.current.undo(true);
  };

  return (
    <div className="flex-1 relative flex flex-col">
      {/* Action Bar */}
      <div className="h-14 bg-card border-b border-border flex items-center justify-between px-4 gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-foreground">Trading Strategy Builder</h2>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Blocks className="w-3 h-3" />
            {blockCount} blocks
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {/* File Operations Group */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveWorkspace}
              >
                <Download className="w-4 h-4 mr-2" />
                Save
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
                onClick={handleLoadWorkspace}
              >
                <Upload className="w-4 h-4 mr-2" />
                Load
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Load workspace from XML file</p>
              <p className="text-xs text-muted-foreground mt-1">Ctrl+O</p>
            </TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6" />

          {/* Execution Group */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="sm"
                onClick={handleRunStrategy}
              >
                <Play className="w-4 h-4 mr-2" />
                Run
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Execute trading strategy</p>
              <p className="text-xs text-muted-foreground mt-1">Ctrl+Enter</p>
            </TooltipContent>
          </Tooltip>

          <Separator orientation="vertical" className="h-6" />

          {/* Workspace Controls */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUndo}
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
                onClick={handleRedo}
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
                onClick={() => handleZoom('out')}
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Zoom out</p>
            </TooltipContent>
          </Tooltip>

          <Badge variant="secondary" className="px-2 min-w-[60px] justify-center">
            {zoomLevel}%
          </Badge>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleZoom('in')}
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
                onClick={handleCenterWorkspace}
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
                onClick={() => setShowCode(!showCode)}
              >
                <Code2 className="w-4 h-4 mr-2" />
                {showCode ? 'Hide' : 'Code'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Toggle code preview panel</p>
              <p className="text-xs text-muted-foreground mt-1">Ctrl+K</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 relative flex">
        {/* Blockly Workspace */}
        <div className={showCode ? "flex-1" : "w-full"}>
          <div 
            ref={blocklyDiv} 
            className="absolute inset-0"
            style={{ height: '100%', width: showCode ? 'calc(100% - 400px)' : '100%' }}
          />
          
          {/* Welcome Screen */}
          {isEmpty && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-card/95 border border-border rounded-lg p-8 max-w-md text-center shadow-lg backdrop-blur-sm">
                <Blocks className="w-16 h-16 mx-auto mb-4 text-primary" />
                <h3 className="text-xl font-semibold text-foreground mb-2">Welcome to Strategy Builder</h3>
                <p className="text-muted-foreground mb-6">
                  Start building your trading strategy by dragging blocks from the toolbox on the left.
                </p>
                <div className="space-y-2 text-sm text-left text-muted-foreground">
                  <div className="flex items-start gap-2">
                    <span className="text-primary font-bold">1.</span>
                    <span>Choose blocks from the categories: Environment, Operators, Control, Trade, and TA Tools</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-primary font-bold">2.</span>
                    <span>Connect blocks together to create your trading logic</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-primary font-bold">3.</span>
                    <span>Preview the generated code and test your strategy</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Code Preview Panel */}
        {showCode && (
          <div className="w-[400px] bg-card border-l border-border flex flex-col">
            <div className="h-12 border-b border-border flex items-center justify-between px-4">
              <h3 className="font-semibold text-foreground">Generated Code</h3>
              <div className="flex gap-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleExportCode}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Export as .js file</p>
                  </TooltipContent>
                </Tooltip>
                
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyCode}
                    >
                      {copied ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Copy to clipboard</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-sm text-foreground font-mono bg-secondary/50 p-4 rounded-lg whitespace-pre-wrap break-words">
                {generatedCode || '// No blocks yet\n// Drag blocks from the toolbox to start building your strategy'}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
