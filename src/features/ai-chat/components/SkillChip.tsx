/**
 * SkillChip — current-skill indicator + opener for SkillPicker.
 *
 * Sits in the panel header. Default state shows "No skill"; selecting a skill
 * shows its icon + name in its accent color.
 */

import { useState } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';
import { usePanelStore } from '../state/panelStore';
import { getSkill } from '../skills/registry';
import { SkillPicker } from './SkillPicker';

export function SkillChip() {
  const skillId = usePanelStore((s) => s.skillId);
  const [open, setOpen] = useState(false);
  const skill = getSkill(skillId);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10.5px] transition-colors ${
          skill
            ? skill.accentColor + ' hover:opacity-90'
            : 'text-white/60 bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.06]'
        }`}
      >
        {skill ? (
          <skill.icon className="w-3 h-3" />
        ) : (
          <Sparkles className="w-3 h-3 text-white/40" />
        )}
        <span className="font-medium">{skill?.label ?? 'No skill'}</span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>
      {open && <SkillPicker onClose={() => setOpen(false)} />}
    </div>
  );
}
