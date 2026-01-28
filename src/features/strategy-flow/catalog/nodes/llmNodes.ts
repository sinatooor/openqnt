/**
 * LLM Nodes - Prompt-based decision nodes
 */
import { NodeCatalogItem } from '../../types';

export const LLM_NODES: NodeCatalogItem[] = [
  {
    type: 'llmDecision',
    nodeType: 'llm',
    label: 'LLM Decision',
    description: 'LLM outputs structured JSON',
    tooltip: 'Runs a prompt and returns a JSON decision object (e.g., {"shouldTrade": true}).',
    inputs: ['Trigger'],
    outputs: ['JSON'],
    category: 'llm',
    subcategory: 'AI',
    icon: 'Sparkles',
    color: '#a855f7',
    defaultData: {
      label: 'LLM Decision',
      prompt: 'Decide whether to enter a trade based on context.',
      schema: { shouldTrade: 'boolean', confidence: 'number' },
      fallback: { shouldTrade: false, confidence: 0 },
    },
  },
];
