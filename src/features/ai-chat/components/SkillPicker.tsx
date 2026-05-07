/**
 * SkillPicker — dropdown listing all financial-role skills with description.
 *
 * Switching skill mid-thread inserts a skill_change divider on the next send
 * (handled by useChatTransport).
 */

import { useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import { SKILLS } from '../skills/registry';
import { usePanelStore } from '../state/panelStore';

interface Props {
  onClose: () => void;
}

export function SkillPicker({ onClose }: Props) {
  const skillId = usePanelStore((s) => s.skillId);
  const setSkill = usePanelStore((s) => s.setSkill);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      // Open upwards because the SkillChip lives in the Composer's bottom
      // toolbar — a downward menu would land below the viewport.
      className="absolute bottom-full left-0 mb-2 z-[510] w-72 rounded-lg bg-[#15151b] border border-white/10 shadow-xl overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-white/40">
        Skills
      </div>
      <div className="max-h-80 overflow-auto py-1">
        <button
          onClick={() => {
            setSkill(null);
            onClose();
          }}
          className={`w-full flex items-start gap-2 px-3 py-2 hover:bg-white/[0.04] text-left transition-colors ${
            skillId === null ? 'bg-white/[0.03]' : ''
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 mt-0.5 text-white/40 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[12px] text-white/90 font-medium">No skill</div>
            <div className="text-[10.5px] text-white/40 truncate">Vanilla AI assistant.</div>
          </div>
          {skillId === null && (
            <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5" />
          )}
        </button>
        <div className="h-px bg-white/[0.04] mx-2 my-1" />
        {SKILLS.map((s) => {
          const Icon = s.icon;
          const active = skillId === s.id;
          return (
            <button
              key={s.id}
              onClick={() => {
                setSkill(s.id);
                onClose();
              }}
              className={`w-full flex items-start gap-2 px-3 py-2 hover:bg-white/[0.04] text-left transition-colors ${
                active ? 'bg-white/[0.03]' : ''
              }`}
            >
              <Icon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 opacity-80" />
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-white/90 font-medium">{s.label}</div>
                <div className="text-[10.5px] text-white/40 line-clamp-2">{s.shortDescription}</div>
              </div>
              {active && <div className="w-1.5 h-1.5 rounded-full bg-purple-400 mt-1.5 flex-shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
