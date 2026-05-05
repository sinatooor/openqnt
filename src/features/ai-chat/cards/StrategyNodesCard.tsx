/**
 * StrategyNodesCard — renders generated strategy nodes with a layered preview
 * and "Add to Canvas" / "Replace Canvas" actions.
 *
 * Used by both Ask mode (streaming nodes via card events) and Strategy mode
 * (a single complete card from /api/strategy-flow/generate).
 */

import { motion } from 'framer-motion';
import { Blocks, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useStrategyFlowStore } from '@/features/strategy-flow/store/strategyFlowStore';
import { layoutStrategyNodes } from '@/features/strategy-flow/utils/layoutNodes';
import { PinButton } from '../components/PinButton';

const NODE_TYPE_COLORS: Record<string, string> = {
  environment: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-300',
  indicator:   'border-purple-500/40 bg-purple-500/10 text-purple-300',
  trigger:     'border-amber-500/40 bg-amber-500/10 text-amber-300',
  llm:         'border-violet-500/40 bg-violet-500/10 text-violet-300',
  math:        'border-teal-500/40 bg-teal-500/10 text-teal-300',
  variable:    'border-pink-500/40 bg-pink-500/10 text-pink-300',
  tradeInfo:   'border-cyan-500/40 bg-cyan-500/10 text-cyan-300',
  condition:   'border-amber-500/40 bg-amber-500/10 text-amber-300',
  control:     'border-slate-400/40 bg-slate-500/10 text-slate-300',
  risk:        'border-red-500/40 bg-red-500/10 text-red-300',
  action:      'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  integration: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
};

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

  const { nodes: layouted } = layoutStrategyNodes(nodes, edges);

  const layerMap = new Map<number, typeof layouted>();
  for (const n of layouted) {
    const x = n.position.x;
    if (!layerMap.has(x)) layerMap.set(x, []);
    layerMap.get(x)!.push(n);
  }
  const layers = Array.from(layerMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([, group]) => group);

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
            {layers.length} layers · {edges.length} connections
          </span>
          <PinButton
            cardType="strategy_nodes"
            payload={{ nodes, edges, message }}
            title={`${nodes.length} nodes`}
          />
        </div>
      </div>

      <div className="px-3 py-3 overflow-x-auto">
        <div className="flex items-start gap-2 min-w-min">
          {layers.map((layer, li) => (
            <div key={li} className="flex items-center gap-2">
              <div className="flex flex-col gap-1.5 min-w-[110px]">
                {layer.map((node: any, ni: number) => {
                  const colors =
                    NODE_TYPE_COLORS[node.type || ''] ||
                    'border-white/20 bg-white/5 text-white/50';
                  return (
                    <motion.div
                      key={node.id || ni}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: (li * layer.length + ni) * 0.04 }}
                      className={`px-2.5 py-1.5 rounded-md border text-[10px] font-medium truncate ${colors}`}
                      title={`${node.type}: ${node.data?.label || node.id}`}
                    >
                      {node.data?.label || node.type || 'Node'}
                    </motion.div>
                  );
                })}
              </div>
              {li < layers.length - 1 && (
                <ChevronRight className="w-3.5 h-3.5 text-white/15 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
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
