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
import { Code2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

export const BlocklyWorkspace = () => {
  const blocklyDiv = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);

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

    // Listen to workspace changes to update code
    workspace.addChangeListener(() => {
      const code = generateCode(workspace);
      setGeneratedCode(code);
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

  return (
    <div className="flex-1 relative flex flex-col">
      {/* Action Bar */}
      <div className="h-12 bg-card border-b border-border flex items-center justify-between px-4">
        <h2 className="font-semibold text-foreground">Trading Strategy Builder</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCode(!showCode)}
        >
          <Code2 className="w-4 h-4 mr-2" />
          {showCode ? 'Hide Code' : 'View Code'}
        </Button>
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
        </div>

        {/* Code Preview Panel */}
        {showCode && (
          <div className="w-[400px] bg-card border-l border-border flex flex-col">
            <div className="h-12 border-b border-border flex items-center justify-between px-4">
              <h3 className="font-semibold text-foreground">Generated Code</h3>
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
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="text-sm text-foreground font-mono bg-secondary/50 p-4 rounded-lg">
                {generatedCode || '// No blocks yet\n// Drag blocks from the toolbox to start building your strategy'}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
