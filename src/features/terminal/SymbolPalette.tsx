/**
 * SymbolPalette — global cmd+k overlay for changing the active terminal
 * symbol.
 *
 * Mounted once at the App level. Captures ⌘K / Ctrl+K from anywhere
 * (except inside other inputs that already use cmd+k for their own
 * thing — strategy-flow, see StrategyFlowCanvas.tsx). Submitting:
 *   1. updates `terminalSymbolStore.activeSymbol`
 *   2. navigates to a terminal screen with that ticker
 *      (defaulting to DES; or stays on the current `/terminal/<fn>` if
 *      already inside one).
 *
 * Bloomberg-equivalent: typing a new ticker into the global "blue line".
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTerminalSymbolStore } from '@/stores/terminalSymbolStore';

// Mnemonics that take a ticker and the relative path under /terminal/.
const FUNCTION_PATHS: Record<string, string> = {
  des: 'des',
  gip: 'gip',
  hds: 'hds',
  splc: 'splc',
  rmap: 'rmap',
};

function inferActiveFunction(pathname: string): string {
  const m = pathname.match(/^\/terminal\/([^/]+)/i);
  if (!m) return 'des';
  const fn = m[1].toLowerCase();
  return FUNCTION_PATHS[fn] ?? 'des';
}

export default function SymbolPalette() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { activeSymbol, recents, setActiveSymbol } = useTerminalSymbolStore();

  // Global hotkey. Skip when the user is already inside a text input that
  // claims cmd+k (e.g. the strategy-flow node search).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isModK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
      if (!isModK) return;
      const target = e.target as HTMLElement | null;
      // The strategy-flow canvas already binds cmd+k for its own search.
      if (location.pathname === '/' || location.pathname.startsWith('/strategy')) {
        return;
      }
      // Don't fight with the user typing into another command bar.
      const inForm = !!target?.closest('input, textarea, [contenteditable="true"]');
      if (inForm && !open) return;
      e.preventDefault();
      setOpen((v) => !v);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keydown', onEsc);
    };
  }, [location.pathname, open]);

  useEffect(() => {
    if (open) {
      setText('');
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = text.trim().toUpperCase();
    if (!q) return recents.slice(0, 8);
    return recents.filter((s) => s.includes(q)).slice(0, 8);
  }, [text, recents]);

  const submit = (raw: string) => {
    const sym = raw.trim().toUpperCase();
    if (!sym) return;
    setActiveSymbol(sym);
    const fn = inferActiveFunction(location.pathname);
    navigate(`/terminal/${fn}/${encodeURIComponent(sym)}`);
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={() => setOpen(false)}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '14vh',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480,
          maxWidth: '90vw',
          background: '#0a0a0f',
          border: '1px solid rgba(255,159,26,0.35)',
          borderRadius: 6,
          boxShadow: '0 12px 40px rgba(0,0,0,0.7)',
          overflow: 'hidden',
          fontFamily: 'ui-monospace, monospace',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            borderBottom: '1px solid #332200',
            background: '#141005',
          }}
        >
          <span style={{ fontSize: 10, color: '#ff9f1a' }}>SYMBOL</span>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit(text || filtered[0] || activeSymbol);
              if (e.key === 'Tab' && filtered[0]) {
                e.preventDefault();
                setText(filtered[0]);
              }
            }}
            placeholder={`Type ticker (current: ${activeSymbol}) — Enter to GO`}
            style={{
              flex: 1,
              background: 'black',
              border: '1px solid #332200',
              color: '#ffd56b',
              padding: '6px 8px',
              fontSize: 12,
              textTransform: 'uppercase',
              outline: 'none',
            }}
          />
          <span style={{ fontSize: 9, color: '#94a3b8' }}>⌘K · ESC</span>
        </div>

        <div style={{ maxHeight: 280, overflow: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: 14, color: '#64748b', fontSize: 11 }}>
              No recents match. Press Enter to go to{' '}
              <span style={{ color: '#ffd56b' }}>{(text || activeSymbol).toUpperCase()}</span>.
            </div>
          ) : (
            filtered.map((sym) => (
              <button
                key={sym}
                onClick={() => submit(sym)}
                style={{
                  display: 'flex',
                  width: '100%',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid #1c1c25',
                  color: '#e2e8f0',
                  fontSize: 12,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#141005')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ color: '#ffd56b' }}>{sym}</span>
                {sym === activeSymbol && (
                  <span style={{ fontSize: 9, color: '#10b981' }}>ACTIVE</span>
                )}
              </button>
            ))
          )}
        </div>

        <div
          style={{
            padding: '6px 12px',
            borderTop: '1px solid #1c1c25',
            fontSize: 9,
            color: '#64748b',
            display: 'flex',
            gap: 12,
          }}
        >
          <span>Tab — autocomplete</span>
          <span>Enter — GO</span>
          <span style={{ marginLeft: 'auto' }}>
            {inferActiveFunction(location.pathname).toUpperCase()}
          </span>
        </div>
      </div>
    </div>
  );
}
