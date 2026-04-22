/**
 * Boss — Phase C page.
 *
 * One input: a high-level objective. Submit → the FastAPI backend fans it
 * out across the registered quant agents in parallel, emits live stream
 * events, and finally runs synthesis. The BossRunTree component subscribes
 * to the boss run's WebSocket and renders the live dispatch tree.
 */

import { useState } from 'react';
import { Brain, Play, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { BossRunTree } from '@/features/boss/BossRunTree';

const API_BASE =
  (import.meta as any).env?.VITE_BACKEND_URL?.replace(/\/$/, '') ??
  'http://localhost:8000';

const Boss = () => {
  const [objective, setObjective] = useState(
    'Research SPY mean-reversion edges: combine technical, fundamentals, and news.',
  );
  const [symbols, setSymbols] = useState('SPY');
  const [runId, setRunId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setStarting(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/boss/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objective: objective.trim(),
          symbols: symbols
            .split(/[,\s]+/)
            .map((s) => s.trim().toUpperCase())
            .filter(Boolean),
        }),
      });
      if (!res.ok) {
        throw new Error(`${res.status}: ${await res.text()}`);
      }
      const body = (await res.json()) as { run_id: string };
      setRunId(body.run_id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground pt-16 pb-0">
      <div className="w-full max-w-5xl mx-auto px-4 md:px-6 flex flex-col h-[calc(100vh-4rem)]">
        <header className="flex items-center gap-2 py-3">
          <Brain className="w-5 h-5 text-purple-400" />
          <h1 className="text-white font-medium text-sm tracking-tight">Boss</h1>
          <div className="h-4 w-px bg-white/10 mx-2" />
          <span className="text-white/40 text-xs">
            Dispatches to your quant agents in parallel · aggregates via synthesis
          </span>
        </header>

        {/* Input card */}
        <Card className="bg-card/60 backdrop-blur-sm border-white/5 p-4 flex flex-col gap-3">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-white/40 block mb-1">
              Objective
            </label>
            <Textarea
              rows={3}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder='e.g. "find a momentum edge in tech stocks"'
              className="bg-black/30 border-white/10 text-white text-[13px]"
            />
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-[11px] uppercase tracking-wider text-white/40 block mb-1">
                Symbols (comma or space separated)
              </label>
              <Input
                value={symbols}
                onChange={(e) => setSymbols(e.target.value)}
                placeholder="SPY, QQQ, AAPL"
                className="bg-black/30 border-white/10 text-white text-[13px]"
              />
            </div>
            <Button
              onClick={start}
              disabled={starting || !objective.trim()}
              className="gap-1.5"
            >
              {starting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              Dispatch
            </Button>
          </div>
          {error && (
            <div className="text-[11.5px] text-red-400 font-mono">{error}</div>
          )}
        </Card>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto mt-4 pb-6">
          {runId ? (
            <BossRunTree key={runId} runId={runId} />
          ) : (
            <div className="text-center text-white/30 text-[13px] py-12">
              Enter an objective and click Dispatch to see the live tree.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Boss;
