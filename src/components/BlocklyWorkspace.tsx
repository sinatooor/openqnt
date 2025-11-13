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
import { Card, CardContent } from '@/components/ui/card';
import { Code2, Copy, Check, Download, Play, Upload, ZoomIn, ZoomOut, Maximize2, RotateCcw, Undo2, Redo2, Blocks, Wand2, FileCode, BarChart3, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { BacktestingPanel } from './BacktestingPanel';
import { runBacktest, BacktestResult } from '@/lib/backtestEngine';

export const BlocklyWorkspace = () => {
  const blocklyDiv = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [blockCount, setBlockCount] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isEmpty, setIsEmpty] = useState(true);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [beautified, setBeautified] = useState(false);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [showBacktest, setShowBacktest] = useState(false);

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

  const handlePreviewBacktest = async () => {
    // Validate workspace has blocks
    if (!workspaceRef.current || isEmpty) {
      toast.error('Add blocks to your workspace first to run a backtest.');
      return;
    }

    if (!generatedCode) {
      toast.error('No strategy code generated. Add blocks to create a strategy.');
      return;
    }

    // Start backtesting
    setIsBacktesting(true);
    setShowBacktest(true);
    toast.info('Running backtest simulation...', {
      description: 'Analyzing historical data with your strategy',
    });

    try {
      // Run backtest with generated code
      const result = await runBacktest(generatedCode, 'BTC/USDT', 90);
      
      setBacktestResult(result);
      
      // Show success toast with key metrics
      toast.success('Backtest completed!', {
        description: `Total Return: ${result.metrics.totalReturn.toFixed(2)}% | Win Rate: ${result.metrics.winRate.toFixed(1)}% | ${result.metrics.totalTrades} trades`,
      });
    } catch (error) {
      console.error('Backtest error:', error);
      toast.error('Backtest failed', {
        description: 'Failed to run backtest simulation. Check your strategy blocks.',
      });
      setShowBacktest(false);
    } finally {
      setIsBacktesting(false);
    }
  };

  const handleCloseBacktest = () => {
    setShowBacktest(false);
    setBacktestResult(null);
  };

  const beautifyCode = (code: string): string => {
    if (!code) return code;
    
    let result = '';
    let indent = 0;
    const lines = code.split('\n');
    
    for (let line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Decrease indent for closing braces
      if (trimmed.startsWith('}')) {
        indent = Math.max(0, indent - 1);
      }
      
      // Add indentation
      result += '  '.repeat(indent) + trimmed + '\n';
      
      // Increase indent for opening braces
      if (trimmed.endsWith('{')) {
        indent++;
      }
    }
    
    return result;
  };

  const getCodeStatistics = () => {
    if (!generatedCode) return { lines: 0, chars: 0, complexity: 0 };
    
    const lines = generatedCode.split('\n').filter(line => line.trim()).length;
    const chars = generatedCode.length;
    
    // Simple complexity estimation based on control structures
    const ifCount = (generatedCode.match(/if\s*\(/g) || []).length;
    const loopCount = (generatedCode.match(/while\s*\(|for\s*\(/g) || []).length;
    const complexity = ifCount + (loopCount * 2) + Math.floor(blockCount / 5);
    
    return { lines, chars, complexity };
  };

  const renderCodeWithLineNumbers = (code: string) => {
    if (!code) {
      return (
        <div className="text-muted-foreground italic">
          // No blocks yet
          <br />
          // Drag blocks from the toolbox to start building your strategy
        </div>
      );
    }

    const displayCode = beautified ? beautifyCode(code) : code;
    const lines = displayCode.split('\n');

    return (
      <div className="flex font-mono text-sm">
        {showLineNumbers && (
          <div className="select-none pr-4 text-muted-foreground/50 text-right border-r border-border">
            {lines.map((_, i) => (
              <div key={i} className="leading-6">
                {i + 1}
              </div>
            ))}
          </div>
        )}
        <div className="flex-1 pl-4">
          {lines.map((line, i) => (
            <div key={i} className="leading-6">
              <code className="syntax-highlight">{highlightSyntax(line)}</code>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const highlightSyntax = (line: string) => {
    if (!line.trim()) return ' ';
    
    // Simple syntax highlighting for JavaScript
    const keywords = ['if', 'else', 'while', 'for', 'function', 'return', 'var', 'let', 'const'];
    const parts: JSX.Element[] = [];
    let remaining = line;
    let key = 0;

    // Handle comments
    if (line.trim().startsWith('//')) {
      return <span className="text-green-500/70">{line}</span>;
    }

    // Simple tokenization
    const tokens = remaining.split(/(\s+|[{}();,])/);
    
    tokens.forEach((token) => {
      if (keywords.includes(token)) {
        parts.push(<span key={key++} className="text-purple-400 font-semibold">{token}</span>);
      } else if (token.match(/^['"].*['"]$/)) {
        parts.push(<span key={key++} className="text-green-400">{token}</span>);
      } else if (token.match(/^\d+$/)) {
        parts.push(<span key={key++} className="text-orange-400">{token}</span>);
      } else if (token.match(/^[{}();,]$/)) {
        parts.push(<span key={key++} className="text-muted-foreground">{token}</span>);
      } else {
        parts.push(<span key={key++}>{token}</span>);
      }
    });

    return <>{parts}</>;
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

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="sm"
                onClick={handlePreviewBacktest}
                disabled={isBacktesting || isEmpty}
              >
                <TrendingUp className="w-4 h-4 mr-2" />
                {isBacktesting ? 'Testing...' : 'Preview Backtest'}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Run backtest simulation</p>
              <p className="text-xs text-muted-foreground mt-1">Test your strategy on historical data</p>
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
        <div className="flex-1">
          <div 
            ref={blocklyDiv} 
            className="absolute inset-0"
            style={{ 
              height: '100%', 
              width: showCode 
                ? showBacktest 
                  ? 'calc(100% - 450px - 500px)' 
                  : 'calc(100% - 450px)'
                : showBacktest
                  ? 'calc(100% - 500px)'
                  : '100%'
            }}
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
          <div className="w-[450px] bg-card border-l border-border flex flex-col">
            {/* Code Panel Header */}
            <div className="border-b border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <FileCode className="w-4 h-4" />
                  Generated Code
                </h3>
                <div className="flex gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={beautified ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setBeautified(!beautified)}
                      >
                        <Wand2 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Beautify code</p>
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={showLineNumbers ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setShowLineNumbers(!showLineNumbers)}
                      >
                        <BarChart3 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Toggle line numbers</p>
                    </TooltipContent>
                  </Tooltip>

                  <Separator orientation="vertical" className="h-6 mx-1" />
                  
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

              {/* Code Statistics */}
              {generatedCode && (
                <Card className="bg-secondary/30">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-4">
                        <div>
                          <span className="text-muted-foreground">Lines:</span>
                          <span className="ml-1 font-semibold text-foreground">{getCodeStatistics().lines}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Blocks:</span>
                          <span className="ml-1 font-semibold text-foreground">{blockCount}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Complexity:</span>
                          <Badge 
                            variant={
                              getCodeStatistics().complexity < 5 ? "default" : 
                              getCodeStatistics().complexity < 10 ? "secondary" : 
                              "destructive"
                            }
                            className="ml-1 text-xs"
                          >
                            {getCodeStatistics().complexity < 5 ? 'Low' : 
                             getCodeStatistics().complexity < 10 ? 'Medium' : 
                             'High'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Code Display Area */}
            <div className="flex-1 overflow-auto p-4 bg-secondary/20">
              <div className="bg-background/50 rounded-lg p-4 border border-border">
                {renderCodeWithLineNumbers(generatedCode)}
              </div>
            </div>
          </div>
        )}

        {/* Backtesting Panel */}
        {showBacktest && (
          <BacktestingPanel
            result={backtestResult}
            isLoading={isBacktesting}
            symbol="BTC/USDT"
            onClose={handleCloseBacktest}
          />
        )}
      </div>
    </div>
  );
};
