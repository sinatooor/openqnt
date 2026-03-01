/**
 * TriggerNode — Entry point nodes for workflow execution.
 * Renders Heartbeat, Webhook, Price Alert, News, Broker Event, Manual, Cron triggers.
 */

import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import * as Icons from 'lucide-react';
import { StrategyBaseNode } from './StrategyBaseNode';
import { TriggerNodeData } from '../../types';
import { TRIGGER_NODES } from '../../catalog/nodeCatalog';

export const TriggerNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as unknown as TriggerNodeData;
  const catalogItem = TRIGGER_NODES.find(n => n.type === nodeData.triggerType);
  const IconComponent = catalogItem ? (Icons as any)[catalogItem.icon] : Icons.Zap;
  const color = catalogItem?.color || '#8b5cf6';

  const getDetails = () => {
    switch (nodeData.triggerType) {
      case 'heartbeatTrigger':
        return nodeData.intervalMinutes ? `Every ${nodeData.intervalMinutes}m` : 'Schedule';
      case 'webhookTrigger':
        return nodeData.webhookPath || 'HTTP POST';
      case 'priceAlertTrigger':
        return nodeData.symbol
          ? `${nodeData.symbol} ${nodeData.condition?.replace('_', ' ')} ${nodeData.priceLevel ?? ''}`
          : 'Price threshold';
      case 'newsTrigger':
        return nodeData.keywords?.length ? nodeData.keywords.slice(0, 2).join(', ') : 'News event';
      case 'brokerEventTrigger':
        return nodeData.eventTypes?.join(', ') || 'Broker event';
      case 'manualTrigger' as any:
        return 'Click to run';
      case 'cronTrigger' as any:
        return (nodeData as any).cronExpression || 'Cron schedule';
      default:
        return catalogItem?.description || 'Trigger';
    }
  };

  return (
    <StrategyBaseNode
      id={id}
      data={nodeData}
      selected={selected}
      nodeType="trigger"
      subType={nodeData.triggerType}
      color={color}
      icon={<IconComponent className="w-4 h-4" />}
    >
      <div className="text-xs text-white/70 truncate">{getDetails()}</div>
    </StrategyBaseNode>
  );
});

TriggerNode.displayName = 'TriggerNode';
