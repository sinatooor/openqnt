/**
 * Mode registry — descriptors for each ChatMode.
 *
 * Maps mode → label, icon, transport, placeholder, default-skill suggestion.
 * The Composer reads from here to render the ModeBar; useChatTransport reads
 * from here to dispatch to the right transport.
 */

import {
  Sparkles,
  Boxes,
  Code2,
  Brain,
  type LucideIcon,
} from 'lucide-react';
import type { ChatMode } from '../types';
import type { Transport } from './types';
import { sseTransport } from './sseTransport';
import { strategyTransport, codeTransport } from './fetchTransport';
import { bossTransport } from './wsTransport';

export interface ModeDescriptor {
  id: ChatMode;
  label: string;
  shortLabel: string;
  description: string;
  placeholder: string;
  icon: LucideIcon;
  accentColor: string; // tailwind classes for chip
  transport: Transport;
}

export const MODE_REGISTRY: Record<ChatMode, ModeDescriptor> = {
  ask: {
    id: 'ask',
    label: 'Ask',
    shortLabel: 'Ask',
    description: 'General chat with full tool access — portfolio, backtests, news, education.',
    placeholder: 'Ask anything — strategies, backtests, portfolio, education…',
    icon: Sparkles,
    accentColor: 'text-purple-300 bg-purple-500/15 border-purple-500/30',
    transport: sseTransport,
  },
  strategy: {
    id: 'strategy',
    label: 'Strategy',
    shortLabel: 'Strategy',
    description: 'Generate strategy nodes onto your canvas.',
    placeholder: 'Describe a strategy and I\'ll build the nodes…',
    icon: Boxes,
    accentColor: 'text-pink-300 bg-pink-500/15 border-pink-500/30',
    transport: strategyTransport,
  },
  code: {
    id: 'code',
    label: 'Code',
    shortLabel: 'Code',
    description: 'Generate Pine Script, Python, MQL5, or Nautilus code.',
    placeholder: 'Describe what to code (Pine/Python/MQL5/Nautilus)…',
    icon: Code2,
    accentColor: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30',
    transport: codeTransport,
  },
  boss: {
    id: 'boss',
    label: 'Agent Boss',
    shortLabel: 'Boss',
    description: 'Multi-agent research — boss dispatches parallel quants and synthesizes.',
    placeholder: 'High-level objective. Boss dispatches to your quant agents…',
    icon: Brain,
    accentColor: 'text-blue-300 bg-blue-500/15 border-blue-500/30',
    transport: bossTransport,
  },
};

export const MODE_LIST: ModeDescriptor[] = [
  MODE_REGISTRY.ask,
  MODE_REGISTRY.strategy,
  MODE_REGISTRY.code,
  MODE_REGISTRY.boss,
];

export function getMode(id: ChatMode): ModeDescriptor {
  return MODE_REGISTRY[id];
}
