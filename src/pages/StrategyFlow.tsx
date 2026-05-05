/**
 * StrategyFlowPage - Full-page strategy builder using ReactFlow
 */

import { StrategyFlowCanvas } from '@/features/strategy-flow';
import { useStrategyFlowStore } from '@/features/strategy-flow/store/strategyFlowStore';
import { usePageContext } from '@/features/ai-chat';

const StrategyFlowPage = () => {
  const strategyName = useStrategyFlowStore((s) => s.strategyName);
  const nodeCount = useStrategyFlowStore((s) => s.nodes.length);
  const edgeCount = useStrategyFlowStore((s) => s.edges.length);

  usePageContext({
    page: 'strategy-flow',
    primaryEntity: strategyName
      ? { type: 'strategy', id: strategyName, label: strategyName }
      : undefined,
    visibleData: {
      kind: 'strategy_canvas',
      snapshot: { nodeCount, edgeCount, name: strategyName },
    },
  });

  return <StrategyFlowCanvas />;
};

export default StrategyFlowPage;
