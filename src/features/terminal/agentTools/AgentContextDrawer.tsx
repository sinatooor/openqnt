/**
 * Reusable "agent context" drawer.  Every terminal-function page can drop
 * this in its toolbar to let the user preview and copy the *exact* text an
 * LLM agent would receive when invoking this function.
 *
 *   <AgentContextDrawer
 *     toolCode="HDS"
 *     input={{ ticker: 'AAPL' }}
 *   />
 *
 * The component resolves the tool via `getTerminalTool`, runs `fetch` +
 * `formatForAgent`, and renders the result in a slide-in panel with a
 * "COPY" button.  It deliberately lives in `agentTools/` (not in any
 * specific feature) because the design goal is that this payload is the
 * same thing the agent sees — humans and agents share one formatting path.
 */

import { useEffect, useMemo, useState } from 'react';
import { Bot, Check, Copy, Terminal as TerminalIcon, X } from 'lucide-react';
import { getTerminalTool } from './registry';
import './agent-context.css';

interface AgentContextDrawerProps {
  toolCode: string;
  input: Record<string, unknown>;
  /** Optional display name override for the launcher button */
  buttonLabel?: string;
}

export default function AgentContextDrawer({
  toolCode,
  input,
  buttonLabel,
}: AgentContextDrawerProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const tool = useMemo(() => getTerminalTool(toolCode), [toolCode]);

  useEffect(() => {
    if (!open || !tool) return;
    let cancelled = false;
    setLoading(true);
    Promise.resolve(tool.fetch(input))
      .then((data) => {
        if (cancelled) return;
        setText(tool.formatForAgent(data));
      })
      .catch((err) => {
        if (cancelled) return;
        setText(`# Error\n${(err as Error).message}`);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // input is an object — stringify so deps stay stable across renders.
  }, [open, tool, JSON.stringify(input)]); // eslint-disable-line react-hooks/exhaustive-deps

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  if (!tool) return null;

  const argSummary = Object.entries(input)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(' ');

  return (
    <>
      <button className="agent-ctx-launcher" onClick={() => setOpen(true)}>
        <Bot className="agent-ctx-ico" />
        {buttonLabel ?? 'AGENT CONTEXT'}
      </button>

      {open && (
        <div className="agent-ctx-overlay" onClick={() => setOpen(false)}>
          <aside
            className="agent-ctx-panel"
            role="dialog"
            aria-label="Agent context"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="agent-ctx-header">
              <div className="agent-ctx-title">
                <TerminalIcon className="agent-ctx-ico" />
                <span>AGENT CONTEXT — {tool.code}</span>
              </div>
              <div className="agent-ctx-header-right">
                <button className="agent-ctx-copy" onClick={onCopy} disabled={loading}>
                  {copied ? <Check className="agent-ctx-ico" /> : <Copy className="agent-ctx-ico" />}
                  {copied ? 'COPIED' : 'COPY'}
                </button>
                <button className="agent-ctx-close" onClick={() => setOpen(false)}>
                  <X className="agent-ctx-ico" />
                </button>
              </div>
            </header>
            <div className="agent-ctx-meta">
              <div>
                <span>Tool</span>
                <b>{tool.code} — {tool.label}</b>
              </div>
              <div>
                <span>Args</span>
                <b className="agent-ctx-mono">{argSummary || '∅'}</b>
              </div>
              <div>
                <span>Description</span>
                <em>{tool.description}</em>
              </div>
            </div>
            <pre className="agent-ctx-pre">{loading ? 'Loading…' : text}</pre>
            <footer className="agent-ctx-footer">
              <span>
                ℹ Any quant agent in the app can invoke this via{' '}
                <code>callTerminalTool('{tool.code}', {JSON.stringify(input)})</code>
              </span>
            </footer>
          </aside>
        </div>
      )}
    </>
  );
}
