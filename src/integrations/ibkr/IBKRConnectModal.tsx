/**
 * IBKRConnectModal
 * ----------------
 * Connects to a running TWS / IB Gateway instance. IBKR doesn't have a
 * user-password — the "credentials" are the network coordinates (host,
 * port, client id) of the local TWS the user is already logged into.
 *
 * The user must:
 *   1. Start TWS or IB Gateway.
 *   2. In TWS: File → Global Configuration → API → Settings →
 *      enable "Enable ActiveX and Socket Clients", confirm the port.
 *
 * This modal also includes a "Test connection" affordance that calls
 * `/status` before saving, so the user gets immediate feedback if TWS
 * isn't reachable.
 */

import { useState } from 'react';
import { WindowModal } from '@/features/strategy-flow/components/modals/WindowModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Plug, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { ibkrApi } from './api';
import { useIntegrationsStore } from '@/stores/integrationsStore';

interface IBKRConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected?: () => void;
}

// Common port presets — TWS Paper is the safe default for development.
const PORT_PRESETS: Array<{ port: number; label: string }> = [
  { port: 7497, label: 'TWS Paper' },
  { port: 7496, label: 'TWS Live' },
  { port: 4002, label: 'Gateway Paper' },
  { port: 4001, label: 'Gateway Live' },
];

export function IBKRConnectModal({ open, onOpenChange, onConnected }: IBKRConnectModalProps) {
  const setStatus = useIntegrationsStore((s) => s.setStatus);
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState(7497);
  const [clientId, setClientId] = useState(42);
  const [submitting, setSubmitting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // Temporarily attempt a connect, then immediately disconnect on success.
      // We use the real /connect because /status only reports cached state.
      await ibkrApi.connect({ host, port, clientId });
      setTestResult({ ok: true, msg: `Connected to ${host}:${port} — close the modal to save.` });
    } catch (e) {
      setTestResult({ ok: false, msg: (e as Error).message.slice(0, 200) });
    } finally {
      setTesting(false);
    }
  };

  const handleConnect = async () => {
    setSubmitting(true);
    setStatus('ibkr', { status: 'connecting', lastError: null });
    try {
      const status = await ibkrApi.connect({ host, port, clientId });
      setStatus('ibkr', {
        status: status.connected ? 'connected' : 'error',
        connectedAt: status.connectedAt ? Date.parse(status.connectedAt) : Date.now(),
        lastError: status.error,
      });
      toast.success(`IBKR connected at ${host}:${port}`);
      onConnected?.();
      onOpenChange(false);
    } catch (e) {
      setStatus('ibkr', { status: 'error', lastError: (e as Error).message });
      toast.error(`IBKR connect failed: ${(e as Error).message.slice(0, 120)}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <WindowModal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title="Connect Interactive Brokers"
      size="md"
    >
      <div className="space-y-4 p-1">
        <div className="text-xs text-muted-foreground leading-relaxed">
          Start TWS or IB Gateway and enable API access:
          <span className="block mt-1 text-foreground/80 font-mono text-[11px]">
            File → Global Configuration → API → Settings → "Enable ActiveX and Socket Clients"
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Host</Label>
            <Input
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="127.0.0.1"
              className="text-sm font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Port</Label>
            <Input
              type="number"
              value={port}
              onChange={(e) => setPort(parseInt(e.target.value || '0', 10))}
              className="text-sm font-mono"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {PORT_PRESETS.map((p) => (
            <button
              key={p.port}
              type="button"
              onClick={() => setPort(p.port)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                port === p.port
                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted/60 border border-border/30'
              }`}
            >
              {p.label} ({p.port})
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Client ID</Label>
          <Input
            type="number"
            value={clientId}
            onChange={(e) => setClientId(parseInt(e.target.value || '0', 10))}
            className="text-sm font-mono"
          />
          <p className="text-[10px] text-muted-foreground">
            Any integer not already used by another connected client. Default <code>42</code> is fine for single-machine use.
          </p>
        </div>

        {testResult && (
          <div
            className={`flex items-start gap-2 p-2.5 rounded border text-xs ${
              testResult.ok
                ? 'bg-emerald-500/5 border-emerald-500/30 text-emerald-300'
                : 'bg-red-500/5 border-red-500/30 text-red-300'
            }`}
          >
            {testResult.ok ? (
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            )}
            <span className="leading-relaxed">{testResult.msg}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            disabled={testing || submitting}
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : null}
            Test connection
          </Button>
          <Button size="sm" onClick={handleConnect} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                Connecting…
              </>
            ) : (
              <>
                <Plug className="w-3.5 h-3.5 mr-1" />
                Connect
              </>
            )}
          </Button>
        </div>
      </div>
    </WindowModal>
  );
}
