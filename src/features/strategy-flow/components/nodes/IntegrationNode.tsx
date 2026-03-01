/**
 * IntegrationNode — External service connection nodes.
 * Renders Telegram, Slack, Email, SMS, HTTP Request, Database,
 * Python/JS Code, AI Analysis, Merge, Split, Set, Filter, Aggregate, HITL nodes.
 */

import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import * as Icons from 'lucide-react';
import { StrategyBaseNode } from './StrategyBaseNode';
import { IntegrationNodeData } from '../../types';
import { INTEGRATION_NODES } from '../../catalog/nodeCatalog';

export const IntegrationNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as unknown as IntegrationNodeData;
  const catalogItem = INTEGRATION_NODES.find(n => n.type === nodeData.integrationType);
  const IconComponent = catalogItem ? (Icons as any)[catalogItem.icon] : Icons.Plug;
  const color = catalogItem?.color || '#6366f1';

  const getDetails = () => {
    switch (nodeData.integrationType) {
      case 'httpRequestNode':
        return `${nodeData.method ?? 'GET'} ${nodeData.url ? new URL(nodeData.url).hostname : '...'}`;
      case 'telegramNode':
        return nodeData.action === 'waitForReply' ? 'Wait for reply' : 'Send message';
      case 'slackNode':
        return nodeData.channel || '#channel';
      case 'emailNode':
        return nodeData.subject || 'Send email';
      case 'codePythonNode':
        return 'Custom Python';
      case 'codeJavascriptNode':
        return 'Custom JS';
      case 'databaseQueryNode':
        return 'SQL Query';
      case 'aiAnalysisNode':
        return nodeData.analysisType || 'AI Analysis';
      default:
        return catalogItem?.description || 'Integration';
    }
  };

  return (
    <StrategyBaseNode
      id={id}
      data={nodeData}
      selected={selected}
      nodeType="integration"
      subType={nodeData.integrationType}
      color={color}
      icon={<IconComponent className="w-4 h-4" />}
    >
      <div className="text-xs text-white/70 truncate">{getDetails()}</div>
    </StrategyBaseNode>
  );
});

IntegrationNode.displayName = 'IntegrationNode';
