/**
 * LLMNode - AI-powered decision and analysis nodes
 * Supports multiple LLM node types with unique visuals
 */

import { memo } from 'react';
import { NodeProps } from '@xyflow/react';
import * as Icons from 'lucide-react';
import { StrategyBaseNode } from './StrategyBaseNode';
import { LLMNodeData, LLMNodeType, LLM_MODELS } from '../../types';

// Configuration for each LLM node type
const LLM_NODE_CONFIG: Record<LLMNodeType, {
  icon: keyof typeof Icons;
  color: string;
  label: string;
}> = {
  llmDecision: { icon: 'Sparkles', color: '#a855f7', label: 'LLM Decision' },
  sentimentAnalysis: { icon: 'Brain', color: '#ec4899', label: 'Sentiment' },
  regimeDetection: { icon: 'Layers', color: '#06b6d4', label: 'Regime' },
  nlStrategyRules: { icon: 'FileText', color: '#f59e0b', label: 'NL Rules' },
  parameterTuning: { icon: 'SlidersHorizontal', color: '#10b981', label: 'Tune Params' },
  marketRegimeClassification: { icon: 'BarChart3', color: '#8b5cf6', label: 'Market Class' },
  newsSentimentSignal: { icon: 'Newspaper', color: '#ef4444', label: 'News Signal' },
  customCode: { icon: 'Code', color: '#64748b', label: 'Custom Code' },
};

export const LLMNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as unknown as LLMNodeData;
  const llmType = nodeData.llmType || 'llmDecision';
  const config = LLM_NODE_CONFIG[llmType] || LLM_NODE_CONFIG.llmDecision;
  
  const IconComponent = Icons[config.icon] as React.ComponentType<{ className?: string }>;
  const modelInfo = LLM_MODELS.find(m => m.id === nodeData.model);

  // Render content based on node type
  const renderContent = () => {
    if (llmType === 'customCode') {
      const codePreview = (nodeData.code || '').split('\n').slice(0, 3).join('\n');
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70">
              {nodeData.language || 'python'}
            </span>
          </div>
          <pre className="text-[10px] text-white/50 font-mono line-clamp-2 overflow-hidden">
            {codePreview || '// No code'}
          </pre>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <div className="text-xs text-white/60 line-clamp-2">
          {nodeData.prompt || 'Configure prompt...'}
        </div>
        {modelInfo && (
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70">
              {modelInfo.label}
            </span>
            {nodeData.temperature !== undefined && (
              <span className="text-[10px] text-white/40">
                T: {nodeData.temperature}
              </span>
            )}
          </div>
        )}
        {nodeData.schema && (
          <div className="text-[10px] text-white/40">
            → {Object.keys(nodeData.schema).slice(0, 3).join(', ')}
          </div>
        )}
      </div>
    );
  };

  return (
    <StrategyBaseNode
      id={id}
      data={nodeData}
      selected={selected}
      nodeType="llm"
      subType={llmType}
      color={config.color}
      icon={<IconComponent className="w-4 h-4" />}
    >
      {renderContent()}
    </StrategyBaseNode>
  );
});

LLMNode.displayName = 'LLMNode';
