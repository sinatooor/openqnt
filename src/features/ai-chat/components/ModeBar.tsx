/**
 * ModeBar — pill buttons UNDER the composer for switching mode.
 *
 * Switching mode mid-thread doesn't immediately add a divider; the divider is
 * inserted on the next send by useChatTransport, so the user can change their
 * mind without polluting the conversation.
 */

import { MODE_LIST } from '../transports/modeRegistry';
import { usePanelStore } from '../state/panelStore';

interface Props {
  /** Inside the Composer toolbar we already have spacing — drop the top margin. */
  inline?: boolean;
}

export function ModeBar({ inline = false }: Props = {}) {
  const mode = usePanelStore((s) => s.mode);
  const setMode = usePanelStore((s) => s.setMode);

  return (
    <div className={`flex items-center gap-1 ${inline ? '' : 'mt-1.5'}`}>
      {MODE_LIST.map((m) => {
        const Icon = m.icon;
        const active = mode === m.id;
        return (
          <button
            key={m.id}
            onClick={() => setMode(m.id)}
            title={m.description}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors ${
              active
                ? m.accentColor
                : 'text-white/50 bg-transparent border-white/[0.06] hover:bg-white/[0.04] hover:text-white/80'
            }`}
          >
            <Icon className="w-3 h-3" />
            <span>{m.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
