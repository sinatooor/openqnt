/**
 * ToolsPanel — Phase G read-only catalogue + sandbox playground.
 *
 * Three sections:
 *   1. Static tools (modules under backend/adk_agents/tools/).
 *   2. Dynamic tools (agent-authored, persisted under
 *      agents/tools/dynamic/<name>.py). Click one to inspect its
 *      signature + source. Delete sends DELETE /api/tools/dynamic/{name}.
 *   3. Sandbox playground — paste Python, run it under the same Phase-G
 *      sandbox the agents use (CPU/RSS/file-size capped, headless
 *      matplotlib, plot-PNG harvesting).
 */

import { useEffect, useMemo, useState } from 'react';
import {
  callDynamicTool,
  createDynamicTool,
  deleteDynamicTool,
  executeSandbox,
  getDynamicSource,
  listTools,
  type DynamicToolMeta,
  type SandboxResult,
  type ToolsListResponse,
} from './api';

const C = {
  bg: '#0a0a12',
  panel: '#171723',
  border: 'rgba(139,92,246,0.18)',
  amber: '#ff9f1a',
  text: '#e2e8f0',
  muted: '#94a3b8',
  good: '#10b981',
  bad: '#ef4444',
  accent: '#8b5cf6',
};

const SAMPLE_CODE = `# Default sandbox example — runs in an isolated subprocess
# with CPU / RSS / file-size limits enforced via setrlimit.
import statistics

returns = [-2.1, -1.4, -0.7, 0.0, 0.3, 0.8, 1.2, 1.8]
print("mean:", statistics.mean(returns))
print("stdev:", statistics.stdev(returns))
`;

const SAMPLE_TOOL = `def compute_var_95(returns: list[float]) -> dict:
    """Empirical Value-at-Risk at the 95% confidence level."""
    if not returns:
        return {"var_95": 0.0, "n": 0}
    s = sorted(returns)
    idx = max(0, int(0.05 * len(s)) - 1)
    return {"var_95": float(s[idx]), "n": len(s)}
`;

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        padding: 14,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionHeader({ title, count, hint }: { title: string; count?: number; hint?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
      <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: C.text }}>{title}</h3>
      {count !== undefined && (
        <span
          style={{
            fontSize: 11,
            color: C.amber,
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          {count}
        </span>
      )}
      {hint && <span style={{ marginLeft: 'auto', fontSize: 11, color: C.muted }}>{hint}</span>}
    </div>
  );
}

export default function ToolsPanel() {
  const [data, setData] = useState<ToolsListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDyn, setSelectedDyn] = useState<{ meta: DynamicToolMeta; source: string } | null>(null);

  // Sandbox playground state
  const [sandboxCode, setSandboxCode] = useState(SAMPLE_CODE);
  const [sandboxResult, setSandboxResult] = useState<SandboxResult | null>(null);
  const [sandboxRunning, setSandboxRunning] = useState(false);

  // Author state
  const [newName, setNewName] = useState('compute_var_95');
  const [newDescription, setNewDescription] = useState('Empirical 95% Value-at-Risk');
  const [newCode, setNewCode] = useState(SAMPLE_TOOL);
  const [authorError, setAuthorError] = useState<string[] | null>(null);
  const [callKwargs, setCallKwargs] = useState('{"returns":[-2.1,-1.0,0.5,1.2,2.4]}');
  const [callResult, setCallResult] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setData(await listTools());
      setError(null);
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const dynamicMap = useMemo(() => {
    const m = new Map<string, DynamicToolMeta>();
    for (const t of data?.dynamic ?? []) m.set(t.name, t);
    return m;
  }, [data]);

  const onSelectDynamic = async (name: string) => {
    try {
      const r = await getDynamicSource(name);
      setSelectedDyn(r);
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
  };

  const onSandboxRun = async () => {
    setSandboxRunning(true);
    setSandboxResult(null);
    try {
      const r = await executeSandbox(sandboxCode);
      setSandboxResult(r);
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setSandboxRunning(false);
    }
  };

  const onAuthor = async () => {
    setAuthorError(null);
    try {
      const r = await createDynamicTool(newName, newCode, newDescription);
      if (!r.ok) {
        setAuthorError(r.errors ?? ['unknown error']);
        return;
      }
      await refresh();
      setSelectedDyn({ meta: r.meta!, source: newCode });
    } catch (e: any) {
      setAuthorError([e.message ?? String(e)]);
    }
  };

  const onCall = async () => {
    if (!selectedDyn) return;
    setCallResult(null);
    try {
      const kwargs = callKwargs.trim() ? JSON.parse(callKwargs) : {};
      const r = await callDynamicTool(selectedDyn.meta.name, kwargs);
      setCallResult(JSON.stringify(r, null, 2));
    } catch (e: any) {
      setCallResult(`error: ${e.message ?? String(e)}`);
    }
  };

  const onDelete = async (name: string) => {
    if (!confirm(`Delete dynamic tool "${name}"?`)) return;
    try {
      await deleteDynamicTool(name);
      if (selectedDyn?.meta.name === name) setSelectedDyn(null);
      await refresh();
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(260px, 320px) 1fr',
        gap: 16,
        padding: 20,
        background: C.bg,
        color: C.text,
        minHeight: '100%',
      }}
    >
      {/* ── Left: tool catalogue ─────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Tools</h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: C.muted }}>
            Static + agent-authored dynamic tools, plus a sandbox playground.
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: 10,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 6,
              fontSize: 12,
              color: C.bad,
            }}
          >
            {error}
          </div>
        )}

        <Card>
          <SectionHeader
            title="Dynamic"
            count={data?.dynamic.length ?? 0}
            hint="agent-authored"
          />
          {data?.dynamic.length === 0 && (
            <div style={{ fontSize: 11, color: C.muted, padding: '8px 0' }}>
              None yet. Author one on the right →
            </div>
          )}
          {data?.dynamic.map((t) => (
            <div
              key={t.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 0',
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              <button
                onClick={() => onSelectDynamic(t.name)}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: selectedDyn?.meta.name === t.name ? C.amber : C.text,
                  padding: 0,
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 12,
                }}
              >
                {t.name}
              </button>
              <button
                onClick={() => onDelete(t.name)}
                title="Delete"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: C.muted,
                  cursor: 'pointer',
                  fontSize: 11,
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </Card>

        <Card>
          <SectionHeader
            title="Static"
            count={data?.static.length ?? 0}
            hint="built-ins"
          />
          <div style={{ maxHeight: 360, overflow: 'auto' }}>
            {data?.static.map((t) => (
              <div
                key={t.name}
                style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: 11,
                  padding: '4px 0',
                  color: C.text,
                  borderBottom: `1px solid ${C.border}`,
                }}
                title={t.description}
              >
                {t.name}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── Right: sandbox + authoring ───────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        {/* Sandbox playground */}
        <Card>
          <SectionHeader
            title="Sandbox · execute_python"
            hint="POST /api/tools/sandbox/execute · CPU/RSS/file-size capped"
          />
          <textarea
            value={sandboxCode}
            onChange={(e) => setSandboxCode(e.target.value)}
            spellCheck={false}
            style={{
              width: '100%',
              minHeight: 140,
              fontFamily: 'ui-monospace, monospace',
              fontSize: 12,
              background: '#000',
              color: C.text,
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              padding: 8,
              resize: 'vertical',
            }}
          />
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={onSandboxRun}
              disabled={sandboxRunning}
              style={{
                background: sandboxRunning ? '#5b3fb6' : C.accent,
                color: 'white',
                border: 'none',
                padding: '6px 14px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                cursor: sandboxRunning ? 'wait' : 'pointer',
              }}
            >
              {sandboxRunning ? 'Running…' : 'Run'}
            </button>
            {sandboxResult && (
              <span style={{ fontSize: 11, color: C.muted }}>
                exit {sandboxResult.exit_code} · {sandboxResult.duration_ms}ms
                {sandboxResult.timed_out && ' · timed out'}
              </span>
            )}
          </div>
          {sandboxResult && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sandboxResult.stdout && (
                <pre
                  style={{
                    fontSize: 11,
                    background: '#000',
                    border: `1px solid ${C.border}`,
                    borderRadius: 4,
                    padding: 8,
                    margin: 0,
                    color: C.good,
                    whiteSpace: 'pre-wrap',
                    maxHeight: 200,
                    overflow: 'auto',
                  }}
                >
                  {sandboxResult.stdout}
                </pre>
              )}
              {sandboxResult.stderr && (
                <pre
                  style={{
                    fontSize: 11,
                    background: '#000',
                    border: `1px solid rgba(239,68,68,0.3)`,
                    borderRadius: 4,
                    padding: 8,
                    margin: 0,
                    color: C.bad,
                    whiteSpace: 'pre-wrap',
                    maxHeight: 160,
                    overflow: 'auto',
                  }}
                >
                  {sandboxResult.stderr}
                </pre>
              )}
              {sandboxResult.plots.map((p) =>
                p.content_b64 ? (
                  <img
                    key={p.name}
                    src={`data:image/png;base64,${p.content_b64}`}
                    alt={p.name}
                    style={{
                      maxWidth: '100%',
                      borderRadius: 4,
                      border: `1px solid ${C.border}`,
                    }}
                  />
                ) : null,
              )}
            </div>
          )}
        </Card>

        {/* Author */}
        <Card>
          <SectionHeader title="Author a tool" hint="POST /api/tools/dynamic" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8, marginBottom: 8 }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value.toLowerCase())}
              placeholder="tool_name (snake_case)"
              style={{
                background: '#000',
                color: C.text,
                border: `1px solid ${C.border}`,
                padding: '6px 8px',
                fontSize: 12,
                fontFamily: 'ui-monospace, monospace',
                borderRadius: 4,
              }}
            />
            <input
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="One-line description"
              style={{
                background: '#000',
                color: C.text,
                border: `1px solid ${C.border}`,
                padding: '6px 8px',
                fontSize: 12,
                borderRadius: 4,
              }}
            />
          </div>
          <textarea
            value={newCode}
            onChange={(e) => setNewCode(e.target.value)}
            spellCheck={false}
            style={{
              width: '100%',
              minHeight: 160,
              fontFamily: 'ui-monospace, monospace',
              fontSize: 12,
              background: '#000',
              color: C.text,
              border: `1px solid ${C.border}`,
              borderRadius: 4,
              padding: 8,
              resize: 'vertical',
            }}
          />
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={onAuthor}
              style={{
                background: C.accent,
                color: 'white',
                border: 'none',
                padding: '6px 14px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Validate + Register
            </button>
            <span style={{ fontSize: 10, color: C.muted }}>
              Must export <code>{newName}(args: T) -&gt; T</code> with annotations + docstring.
            </span>
          </div>
          {authorError && (
            <ul
              style={{
                marginTop: 10,
                padding: 10,
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 4,
                fontSize: 11,
                color: C.bad,
                listStyle: 'inside disc',
              }}
            >
              {authorError.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          )}
        </Card>

        {/* Inspect / call selected */}
        {selectedDyn && (
          <Card>
            <SectionHeader
              title={`Inspect · ${selectedDyn.meta.name}`}
              hint={selectedDyn.meta.signature}
            />
            <pre
              style={{
                margin: 0,
                fontSize: 11,
                fontFamily: 'ui-monospace, monospace',
                background: '#000',
                border: `1px solid ${C.border}`,
                borderRadius: 4,
                padding: 10,
                color: C.text,
                maxHeight: 200,
                overflow: 'auto',
              }}
            >
              {selectedDyn.source}
            </pre>
            <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <input
                value={callKwargs}
                onChange={(e) => setCallKwargs(e.target.value)}
                placeholder='kwargs as JSON, e.g. {"returns":[…]}'
                style={{
                  flex: 1,
                  background: '#000',
                  color: C.text,
                  border: `1px solid ${C.border}`,
                  padding: '6px 8px',
                  fontSize: 12,
                  fontFamily: 'ui-monospace, monospace',
                  borderRadius: 4,
                }}
              />
              <button
                onClick={onCall}
                style={{
                  background: C.amber,
                  color: '#000',
                  border: 'none',
                  padding: '6px 14px',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Call
              </button>
            </div>
            {callResult && (
              <pre
                style={{
                  marginTop: 10,
                  fontSize: 11,
                  background: '#000',
                  border: `1px solid ${C.border}`,
                  borderRadius: 4,
                  padding: 10,
                  color: C.good,
                  whiteSpace: 'pre-wrap',
                  maxHeight: 200,
                  overflow: 'auto',
                }}
              >
                {callResult}
              </pre>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
