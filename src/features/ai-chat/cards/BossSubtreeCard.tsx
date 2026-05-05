/**
 * BossSubtreeCard — wraps the existing BossRunTree component as an inline card.
 *
 * BossRunTree subscribes to its own WebSocket internally and renders the live
 * tree. We just hand it the runId.
 */

import { Brain } from 'lucide-react';
import { BossRunTree } from '@/features/boss/BossRunTree';
import { PinButton } from '../components/PinButton';

interface Props {
  payload: { runId: string };
}

export function BossSubtreeCard({ payload }: Props) {
  if (!payload?.runId) return null;
  return (
    <div className="mt-2 rounded-lg border border-blue-500/20 bg-blue-500/5 overflow-hidden">
      <div className="px-3 py-2 border-b border-blue-500/10 flex items-center gap-2 text-xs text-blue-300">
        <Brain className="w-3.5 h-3.5" />
        <span className="font-medium">Multi-Agent Run</span>
        <span className="text-white/30 ml-auto font-mono text-[10px]">{payload.runId.slice(0, 8)}</span>
        <PinButton
          cardType="boss_subtree"
          payload={payload}
          title={`Boss · ${payload.runId.slice(0, 8)}`}
        />
      </div>
      <div className="px-3 py-3 max-h-[480px] overflow-auto">
        <BossRunTree runId={payload.runId} />
      </div>
    </div>
  );
}
