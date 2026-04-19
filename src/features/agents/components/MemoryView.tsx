/**
 * MemoryView — the agent's `memory.md`. Read-only by default, toggle to edit.
 * Markdown rendered with the same ReactMarkdown setup the rest of the app
 * already uses. Saves straight to the store (which persists to localStorage).
 */

import { memo, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Edit3, Save, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useAgentMonitorStore } from '../store/agentMonitorStore';

interface MemoryViewProps {
  agentId: string;
}

export const MemoryView = memo(({ agentId }: MemoryViewProps) => {
  const memory = useAgentMonitorStore((s) => s.agents[agentId]?.memory ?? '');
  const setMemory = useAgentMonitorStore((s) => s.setMemory);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(memory);

  // Keep draft in sync when memory changes externally (e.g. agent appended).
  useEffect(() => {
    if (!editing) setDraft(memory);
  }, [memory, editing]);

  const save = () => {
    setMemory(agentId, draft);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(memory);
    setEditing(false);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-white/50">memory.md</span>
          <span className="text-[10px] text-white/25">
            {memory.length} chars
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {editing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[10px] gap-1 border-white/10 text-white/60 hover:text-white"
                onClick={cancel}
              >
                <X className="w-3 h-3" />
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-6 px-2 text-[10px] gap-1"
                onClick={save}
              >
                <Save className="w-3 h-3" />
                Save
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px] gap-1 border-white/10 text-white/60 hover:text-white"
              onClick={() => setEditing(true)}
            >
              <Edit3 className="w-3 h-3" />
              Edit
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {editing ? (
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className={cn(
              'w-full h-full min-h-[400px] rounded-none border-0 resize-none',
              'font-mono text-[12px] leading-relaxed text-white/85 bg-transparent',
              'focus-visible:ring-0'
            )}
          />
        ) : (
          <div className="prose-agent px-4 py-3 text-[13px] text-white/85">
            <ReactMarkdown>
              {memory || '_Empty notebook — the agent will fill this in as it works._'}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
});

MemoryView.displayName = 'MemoryView';
