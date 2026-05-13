/**
 * StrategyFlowPage - Full-page strategy builder using ReactFlow
 */

import { StrategyFlowCanvas } from '@/features/strategy-flow';
import { useStrategyFlowStore } from '@/features/strategy-flow/store/strategyFlowStore';
import { useStrategyContext } from '@/features/strategy-flow/store/useStrategyContext';
import { usePageContext } from '@/features/ai-chat';

const StrategyFlowPage = () => {
  const strategyName = useStrategyFlowStore((s) => s.strategyName);
  const nodeCount = useStrategyFlowStore((s) => s.nodes.length);
  const edgeCount = useStrategyFlowStore((s) => s.edges.length);
  const ctx = useStrategyContext();

  usePageContext({
    page: 'strategy-flow',
    primaryEntity: strategyName
      ? { type: 'strategy', id: strategyName, label: strategyName }
      : undefined,
    visibleData: {
      kind: 'strategy_canvas',
      snapshot: {
        nodeCount,
        edgeCount,
        name: strategyName,
        // Strategy Context — surfaces the Start node's scope to the AI so it
        // knows which portfolio/tickers/mode the strategy is bound to.
        context: ctx.hasContext
          ? {
              portfolio: ctx.portfolio,
              tickers: ctx.tickers,
              capital: ctx.capital,
              mode: ctx.mode,
            }
          : null,
      },
    },
  });

  return <StrategyFlowCanvas />;
};

export default StrategyFlowPage;
