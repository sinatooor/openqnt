import { useEffect, useRef } from 'react';
import * as Blockly from 'blockly';
import {
  environmentBlocksToolbox,
  operatorBlocksToolbox,
  controlBlocksToolbox,
  tradeBlocksToolbox,
  taBlocksToolbox,
} from '@/blockly/blocks';

export const BlocklyWorkspace = () => {
  const blocklyDiv = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);

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

    // Cleanup on unmount
    return () => {
      workspace.dispose();
    };
  }, []);

  return (
    <div className="flex-1 relative">
      <div 
        ref={blocklyDiv} 
        className="absolute inset-0"
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  );
};
