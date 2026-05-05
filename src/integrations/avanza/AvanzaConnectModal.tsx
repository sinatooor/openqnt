/**
 * AvanzaConnectModal
 * ------------------
 * TOTP-only login flow for Avanza. Captures username + password + the 2FA
 * secret revealed in Avanza's MFA settings, posts to the backend's
 * /api/integrations/avanza/connect, and updates `integrationsStore` on
 * success.
 */

import { useState } from 'react';
import { WindowModal } from '@/features/strategy-flow/components/modals/WindowModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Plug, ShieldCheck } from 'lucide-react';
import { avanzaApi } from './api';
import { useIntegrationsStore } from '@/stores/integrationsStore';

interface AvanzaConnectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected?: () => void;
}

export function AvanzaConnectModal({ open, onOpenChange, onConnected }: AvanzaConnectModalProps) {
  const setStatus = useIntegrationsStore((s) => s.setStatus);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpSecret, setTotpSecret] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const reset = () => {
    setUsername('');
    setPassword('');
    setTotpSecret('');
  };

  const handleConnect = async () => {
    if (!username.trim() || !password || !totpSecret.trim()) {
      toast.error('Fill in username, password, and TOTP secret');
      return;
    }
    setSubmitting(true);
    setStatus('avanza', { status: 'connecting', lastError: null });
    try {
      const status = await avanzaApi.connect({
        username: username.trim(),
        password,
        totpSecret: totpSecret.trim().replace(/\s+/g, ''),
      });
      setStatus('avanza', {
        status: status.connected ? 'connected' : 'error',
        connectedAt: status.connectedAt ? Date.parse(status.connectedAt) : Date.now(),
        lastError: status.error,
      });
      toast.success('Avanza connected');
      onConnected?.();
      reset();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Avanza login failed';
      setStatus('avanza', { status: 'error', lastError: message });
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <WindowModal
      open={open}
      onOpenChange={onOpenChange}
      title="Connect Avanza"
      icon={<Plug className="w-5 h-5" />}
      defaultWidth={520}
      defaultHeight={620}
    >
      <div className="p-6 space-y-4 text-sm">
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-200/90">
          Avanza has no public API. This integration uses the reverse-engineered
          web endpoints. Endpoints can change without notice; trading writes go
          out as real orders. Verify everything in Avanza before relying on it.
        </div>

        <div className="space-y-2">
          <Label>Username</Label>
          <Input
            placeholder="Avanza login"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={submitting}
            autoComplete="username"
          />
        </div>

        <div className="space-y-2">
          <Label>Password</Label>
          <Input
            type="password"
            placeholder="Avanza password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            autoComplete="current-password"
          />
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            TOTP secret
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </Label>
          <Input
            type="password"
            placeholder="Base32 secret from Avanza's 2FA setup"
            value={totpSecret}
            onChange={(e) => setTotpSecret(e.target.value)}
            disabled={submitting}
            autoComplete="off"
          />
          <button
            type="button"
            className="text-xs text-blue-400 hover:underline"
            onClick={() => setShowHelp((s) => !s)}
          >
            {showHelp ? 'Hide' : 'How do I get this?'}
          </button>
          {showHelp && (
            <ol className="text-xs text-muted-foreground list-decimal pl-5 space-y-1">
              <li>Sign in to avanza.se in a browser.</li>
              <li>Profil → Inställningar → Sajtinställningar → Tvåfaktorsinloggning.</li>
              <li>Click <em>Återaktivera</em>, then <em>Aktivera</em>.</li>
              <li>Choose <em>Annan app för tvåfaktorsinloggning</em>.</li>
              <li>Click <em>Kan du inte scanna QR-koden?</em> — the secret is revealed.</li>
              <li>Paste it here. We store it encrypted with your ENCRYPTION_KEY.</li>
            </ol>
          )}
        </div>

        <div className="flex gap-2 justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleConnect} disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />
                Connecting…
              </>
            ) : (
              'Connect'
            )}
          </Button>
        </div>
      </div>
    </WindowModal>
  );
}

export default AvanzaConnectModal;
