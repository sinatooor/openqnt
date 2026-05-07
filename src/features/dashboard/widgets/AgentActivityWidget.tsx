/**
 * AgentActivityWidget — terminal pane showing recent Boss runs.
 *
 * Fits the Phase F4 brief: a dedicated Agent Activity surface inside the
 * terminal flexlayout. Polls /api/boss/runs every 5s for the latest runs
 * and links each into the BossRunTree at /boss?runId=…. Stays
 * lightweight — no WebSocket subscription per row, just a pulse + status
 * pill.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Brain, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

import { apiBase } from '@/lib/runtimeConfig';
const API_BASE =
  apiBase();

interface BossRunMeta {
  run_id: string;
  agent_id?: string;
  task?: string;
  status?: string;
  started_at?: string;
  ended_at?: string;
  signal?: string;
  confidence?: number;
  conclusion?: string;
}

function relTime(iso?: string): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const diff = Math.max(0, Date.now() - t);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function StatusPill({ status }: { status?: string }) {
  const s = (status || 'unknown').toLowerCase();
  let color = '#94a3b8';
  let bg = 'rgba(148,163,184,0.12)';
  let Icon: typeof Activity = Activity;
  if (s === 'running') {
    color = '#fbbf24';
    bg = 'rgba(251,191,36,0.12)';
    Icon = Loader2;
  } else if (s === 'success') {
    color = '#10b981';
    bg = 'rgba(16,185,129,0.12)';
    Icon = CheckCircle2;
  } else if (s === 'error' || s === 'failed') {
    color = '#ef4444';
    bg = 'rgba(239,68,68,0.12)';
    Icon = AlertCircle;
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '1px 6px',
        borderRadius: 3,
        background: bg,
        color,
        fontSize: 9,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}
    >
      <Icon
        className={s === 'running' ? 'animate-spin' : ''}
        style={{ width: 9, height: 9 }}
      />
      {s}
    </span>
  );
}

export default function AgentActivityWidget() {
  const [runs, setRuns] = useState<BossRunMeta[]>([]);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let stopped = false;
    const fetchRuns = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/boss/runs?limit=20`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = await r.json();
        if (stopped) return;
        setRuns((j.runs || []) as BossRunMeta[]);
        setError(null);
      } catch (e: any) {
        if (!stopped) setError(e.message ?? String(e));
      }
    };
    fetchRuns();
    const id = setInterval(fetchRuns, 5_000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0a0a0f',
        color: '#e2e8f0',
        fontFamily: 'ui-monospace, monospace',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          borderBottom: '1px solid #332200',
          background: '#141005',
          fontSize: 10,
          color: '#ff9f1a',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Brain style={{ width: 11, height: 11 }} />
          Agent Activity · Boss Runs
        </span>
        <button
          onClick={() => navigate('/boss')}
          style={{
            background: 'transparent',
            border: '1px solid #332200',
            color: '#ffd56b',
            fontSize: 9,
            padding: '1px 6px',
            borderRadius: 2,
            cursor: 'pointer',
          }}
        >
          OPEN BOSS →
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', fontSize: 11 }}>
        {error && (
          <div style={{ padding: 12, color: '#ef4444' }}>
            Could not load boss runs — {error}
          </div>
        )}
        {!error && runs.length === 0 && (
          <div style={{ padding: 16, color: '#64748b', textAlign: 'center' }}>
            <Activity style={{ width: 18, height: 18, opacity: 0.4, marginBottom: 6 }} />
            <div>No agent runs yet.</div>
            <div style={{ fontSize: 9, marginTop: 4 }}>
              Dispatch one from /boss to populate this pane.
            </div>
          </div>
        )}
        {runs.map((r) => (
          <button
            key={r.run_id}
            onClick={() => navigate(`/boss?runId=${encodeURIComponent(r.run_id)}`)}
            style={{
              display: 'block',
              width: '100%',
              padding: '8px 10px',
              borderBottom: '1px solid #1c1c25',
              background: 'transparent',
              border: 'none',
              borderLeft: '2px solid transparent',
              textAlign: 'left',
              cursor: 'pointer',
              color: 'inherit',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#141005')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div
              style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}
            >
              <span style={{ color: '#ffd56b', fontWeight: 600, fontSize: 11 }}>
                {r.run_id}
              </span>
              <StatusPill status={r.status} />
            </div>
            {r.task && (
              <div
                style={{
                  marginTop: 3,
                  color: '#cbd5e1',
                  fontSize: 10,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {r.task}
              </div>
            )}
            <div
              style={{
                marginTop: 3,
                display: 'flex',
                gap: 10,
                fontSize: 9,
                color: '#94a3b8',
              }}
            >
              <span>{relTime(r.started_at)}</span>
              {r.signal && (
                <span style={{ color: '#ffd56b' }}>
                  {r.signal}
                  {r.confidence != null && ` · ${(r.confidence * 100).toFixed(0)}%`}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
