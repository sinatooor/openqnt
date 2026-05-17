/**
 * StrategyNodesCard — renders generated strategy nodes as a real mini
 * ReactFlow graph (faithful to what will land on the canvas) with
 * "Add to Canvas" / "Replace Canvas" actions.
 *
 * Used by both Ask mode (streaming nodes via card events) and Strategy mode
 * (a single complete card from /api/strategy-flow/generate).
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Blocks } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ReactFlow, ReactFlowProvider, Background, BackgroundVariant } from '@xyflow/react';
import { Button } from '@/components/ui/button';
import { useStrategyFlowStore } from '@/features/strategy-flow/store/strategyFlowStore';
import { layoutStrategyNodes } from '@/features/strategy-flow/utils/layoutNodes';
import { nodeTypes } from '@/features/strategy-flow/components/nodes';
import { PinButton } from '../components/PinButton';

interface Props {
  nodes: any[];
  edges: any[];
  message?: string;
}

export function StrategyNodesCard({ nodes, edges, message }: Props) {
  const navigate = useNavigate();
  const setNodes = useStrategyFlowStore((s) => s.setNodes);
  const setEdges = useStrategyFlowStore((s) => s.setEdges);

  if (!nodes || nodes.length === 0) return null;

  // Lay out once for both the preview and the "Add to Canvas" action so the
  // user sees the same graph in both places.
  const { nodes: layouted, edges: layoutedEdges } = useMemo(
    () => layoutStrategyNodes(nodes, edges),
    [nodes, edges],
  );

  // Count layers (distinct x positions) for the header summary.
  const layerCount = useMemo(
    () => new Set(layouted.map((n: any) => n.position.x)).size,
    [layouted],
  );

  const handleAdd = (replace: boolean) => {
    const { nodes: laid, edges: laidEdges } = layoutStrategyNodes(nodes, edges);
    const store = useStrategyFlowStore.getState();
    if (replace) {
      setNodes(laid);
      setEdges(laidEdges);
      toast.success(`Replaced canvas with ${laid.length} nodes`);
    } else {
      const existingNodes = store.nodes;
      const existingEdges = store.edges;
      const maxX = existingNodes.reduce((m, n) => Math.max(m, n.position.x), 0);
      const offsetX = maxX > 0 ? maxX + 350 : 0;
      const stamp = Date.now();
      const offsetNodes = laid.map((n: any) => ({
        ...n,
        id: `${n.id}-${stamp}`,
        position: { x: n.position.x + offsetX, y: n.position.y },
      }));
      const idMap = new Map(laid.map((n: any, i: number) => [n.id, offsetNodes[i].id]));
      const offsetEdges = laidEdges.map((e: any) => ({
        ...e,
        id: `${e.id}-${stamp}`,
        source: idMap.get(e.source) || e.source,
        target: idMap.get(e.target) || e.target,
      }));
      setNodes([...existingNodes, ...offsetNodes]);
      setEdges([...existingEdges, ...offsetEdges]);
      toast.success(`Added ${laid.length} nodes to canvas`);
    }
    toast('Switch to Builder to see your strategy', {
      action: { label: 'Go to Builder', onClick: () => navigate('/builder') },
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mt-2 rounded-lg border border-pink-500/20 bg-pink-500/5 overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-pink-500/10 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-pink-300">
          <Blocks className="w-3.5 h-3.5" />
          <span className="font-medium">{nodes.length} Nodes Generated</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/30">
            {layerCount} layers · {edges.length} connections
          </span>
          <PinButton
            cardType="strategy_nodes"
            payload={{ nodes, edges, message }}
            title={`${nodes.length} nodes`}
          />
        </div>
      </div>

      {/*
        Mini ReactFlow preview — read-only, fit-to-view, uses the same
        nodeTypes registry as the main canvas so the preview looks identical
        to what lands after "Add to Canvas". Pointer interactions are
        disabled (no drag/pan/zoom) — clicking the card buttons is the only
        way to act on the strategy.
      */}
      <div className="h-44 w-full border-b border-pink-500/10 bg-[#0e0e10] relative">
        <ReactFlowProvider>
          <ReactFlow
            nodes={layouted as any}
            edges={layoutedEdges as any}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag={false}
            panOnScroll={false}
            zoomOnScroll={false}
            zoomOnPinch={false}
            zoomOnDoubleClick={false}
            preventScrolling={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#27272a" />
          </ReactFlow>
        </ReactFlowProvider>
      </div>

      {message && (
        <div className="px-3 pb-2 text-[11px] text-white/50">{message}</div>
      )}

      <div className="px-3 py-2 border-t border-pink-500/10 flex gap-2">
        <Button
          size="sm"
          onClick={() => handleAdd(false)}
          className="flex-1 h-7 text-xs bg-pink-600 hover:bg-pink-700 text-white font-medium"
        >
          <Blocks className="w-3 h-3 mr-1" />
          Add to Canvas
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleAdd(true)}
          className="h-7 text-xs border-pink-500/30 text-pink-300 hover:bg-pink-500/10"
        >
          Replace Canvas
        </Button>
      </div>
    </motion.div>
  );
}
