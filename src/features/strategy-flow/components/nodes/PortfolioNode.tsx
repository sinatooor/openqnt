/**
 * PortfolioNode — Nodes for reading, analyzing, and managing portfolio data.
 * Renders portfolio-related nodes: read holdings, asset weight, P&L, risk, rebalancer, etc.
 */

import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import * as Icons from 'lucide-react';
import { StrategyBaseNode } from './StrategyBaseNode';
import { PORTFOLIO_NODES } from '../../catalog/nodeCatalog';

interface PortfolioNodeData {
  label?: string;
  portfolioAction?: string;
  symbol?: string;
  symbolA?: string;
  symbolB?: string;
  threshold?: number;
  driftThreshold?: number;
  targetPct?: number;
  goal?: string;
  [key: string]: any;
}

export const PortfolioNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as unknown as PortfolioNodeData;
  const catalogItem = PORTFOLIO_NODES.find(
    (n) => n.type === `portfolio_${nodeData.portfolioAction?.replace(/([A-Z])/g, '_$1').toLowerCase()}`
  ) || PORTFOLIO_NODES.find((n) => n.defaultData.portfolioAction === nodeData.portfolioAction);

  const IconComponent = catalogItem ? (Icons as any)[catalogItem.icon] : Icons.Briefcase;
  const color = catalogItem?.color || '#06b6d4';

  const getDetails = () => {
    switch (nodeData.portfolioAction) {
      case 'readHoldings':
        return 'All holdings';
      case 'totalValue':
        return 'Portfolio total';
      case 'assetWeight':
        return nodeData.symbol ? `${nodeData.symbol} weight` : 'Asset weight';
      case 'assetPnl':
        return nodeData.symbol ? `${nodeData.symbol} P&L` : 'Asset P&L';
      case 'dayChange':
        return 'Daily change';
      case 'concentrationCheck':
        return `Threshold: ${nodeData.threshold ?? 30}%`;
      case 'diversificationScore':
        return 'Portfolio diversity';
      case 'correlationCheck':
        return nodeData.symbolA && nodeData.symbolB
          ? `${nodeData.symbolA} ↔ ${nodeData.symbolB}`
          : 'Correlation';
      case 'drawdown':
        return 'Max drawdown';
      case 'rebalanceSignal':
        return `Drift: ${nodeData.driftThreshold ?? 5}%`;
      case 'setTarget':
        return nodeData.symbol ? `${nodeData.symbol}: ${nodeData.targetPct ?? 0}%` : 'Set target';
      case 'optimize':
        return nodeData.goal === 'minVariance' ? 'Min Variance' : 'Max Sharpe';
      case 'sectorExposure':
        return 'By asset class';
      default:
        return catalogItem?.description || 'Portfolio';
    }
  };

  return (
    <StrategyBaseNode
      id={id}
      // The local `PortfolioNodeData` interface above is intentionally
      // looser than the shared union in types.ts (legacy node — uses
      // optional fields + an open index signature). Cast at the
      // boundary to avoid the union-narrowing error against the strict
      // `StrategyNodeData` shape.
      data={nodeData as any}
      selected={selected}
      nodeType="portfolio"
      subType={nodeData.portfolioAction}
      color={color}
      icon={<IconComponent className="w-4 h-4" />}
    >
      <div className="text-xs text-white/70 truncate">{getDetails()}</div>
    </StrategyBaseNode>
  );
});

PortfolioNode.displayName = 'PortfolioNode';
