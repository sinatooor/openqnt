/**
 * VoiceTab — Profile modal panel for the realtime voice subsystem.
 *
 * Lets the user:
 *   • set / clear an E.164 phone number (used for outbound Twilio calls)
 *   • toggle "Voice trading enabled" — gates mid-call trade tool calls
 *   • mint a pairing token for the OpenQnt iOS app
 *   • see how many iOS devices are paired and the recent call history
 *
 * Reads/writes the FastAPI voice router at /api/voice/*.
 */

import { useEffect, useState } from 'react';
import { Phone, ShieldCheck, ShieldAlert, Smartphone, History, Loader2, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { voiceApi, type VoiceProfile, type VoiceCall } from '@/features/voice/api';

interface VoiceTabProps {
    userId: string | null;
}

export const VoiceTab = ({ userId }: VoiceTabProps) => {
    const [profile, setProfile] = useState<VoiceProfile | null>(null);
    const [phoneInput, setPhoneInput] = useState('');
    const [savingPhone, setSavingPhone] = useState(false);
    const [calls, setCalls] = useState<VoiceCall[]>([]);
    const [pairingToken, setPairingToken] = useState<string | null>(null);
    const [pairingExpiresAt, setPairingExpiresAt] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        (async () => {
            setLoading(true);
            try {
                // getProfile returns `null` for the "no profile yet" 404 case —
                // surface as an empty state, not a toast. Call list is
                // independent; if profile fetch errored we still try calls so
                // the UI degrades gracefully.
                const [p, h] = await Promise.all([
                    voiceApi.getProfile(userId).catch((e) => {
                        // True transport error (network down etc.) — surface once.
                        toast.error(`Voice profile load failed: ${e.message}`);
                        return null;
                    }),
                    voiceApi.listCalls(userId, 10).catch(() => ({ calls: [] })),
                ]);
                if (cancelled) return;
                setProfile(p);
                setPhoneInput(p?.phone_number ?? '');
                setCalls(h.calls);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [userId]);

    if (!userId) {
        return (
            <Card className="bg-card border-border/60">
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                    Sign in to configure voice calls.
                </CardContent>
            </Card>
        );
    }

    const isE164 = (s: string) => /^\+[1-9]\d{6,14}$/.test(s.trim());

    const handleSavePhone = async () => {
        const v = phoneInput.trim();
        if (v && !isE164(v)) {
            toast.error('Enter an E.164 number, e.g. +14155551234');
            return;
        }
        setSavingPhone(true);
        try {
            const res = await voiceApi.updatePhone(userId, v || null);
            setProfile((prev) => (prev ? { ...prev, phone_number: res.phone_number } : prev));
            toast.success(v ? 'Phone number saved' : 'Phone number cleared');
        } catch (e: any) {
            toast.error(`Save failed: ${e.message}`);
        } finally {
            setSavingPhone(false);
        }
    };

    const handleToggleVoiceTrading = async (enabled: boolean) => {
        if (!profile) return;
        const previous = profile.voice_trading_enabled;
        setProfile({ ...profile, voice_trading_enabled: enabled });
        try {
            await voiceApi.setVoiceTradingEnabled(userId, enabled);
            toast.success(enabled ? 'Voice trading enabled' : 'Voice trading disabled');
        } catch (e: any) {
            setProfile({ ...profile, voice_trading_enabled: previous });
            toast.error(`Toggle failed: ${e.message}`);
        }
    };

    const handlePair = async () => {
        try {
            const r = await voiceApi.pairIosInit(userId);
            setPairingToken(r.pairing_token);
            setPairingExpiresAt(r.expires_at);
        } catch (e: any) {
            toast.error(`Pairing failed: ${e.message}`);
        }
    };

    const handleCopyToken = async () => {
        if (!pairingToken) return;
        try {
            await navigator.clipboard.writeText(pairingToken);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        } catch {
            /* clipboard blocked — token is still visible */
        }
    };

    const formatDuration = (s: number | null) => {
        if (s == null) return '—';
        const mins = Math.floor(s / 60);
        const secs = Math.round(s % 60);
        return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
    };

    return (
        <div className="space-y-4">
            {/* Phone number */}
            <Card className="bg-card border-border/60">
                <CardContent className="p-4 space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-primary" />
                        Phone number
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                        Used when the AI places outbound voice calls via Twilio. E.164 format
                        (e.g. <code className="bg-muted px-1 rounded">+14155551234</code>).
                    </p>
                    <div className="flex gap-2">
                        <Input
                            value={phoneInput}
                            onChange={(e) => setPhoneInput(e.target.value)}
                            placeholder="+14155551234"
                            className="flex-1 font-mono"
                            disabled={loading}
                        />
                        <Button onClick={handleSavePhone} disabled={savingPhone || loading} className="gap-1.5">
                            {savingPhone && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            Save
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Voice trading toggle */}
            <Card className="bg-card border-border/60">
                <CardContent className="p-4 flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            {profile?.voice_trading_enabled ? (
                                <ShieldAlert className="w-4 h-4 text-amber-500" />
                            ) : (
                                <ShieldCheck className="w-4 h-4 text-profit" />
                            )}
                            <h4 className="text-sm font-semibold">Voice trading</h4>
                            <Badge variant="outline" className="text-[10px]">
                                {profile?.voice_trading_enabled ? 'ON' : 'OFF'}
                            </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">
                            When ON, the AI can place orders and pause strategies during a call after
                            you say "yes" or "confirm". When OFF, mid-call mutations are blocked.
                        </p>
                    </div>
                    <Switch
                        checked={profile?.voice_trading_enabled ?? false}
                        onCheckedChange={handleToggleVoiceTrading}
                        disabled={loading}
                    />
                </CardContent>
            </Card>

            {/* iOS pairing */}
            <Card className="bg-card border-border/60">
                <CardContent className="p-4 space-y-3">
                    <div className="flex items-start gap-3">
                        <Smartphone className="w-4 h-4 text-primary mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                                OpenQnt iOS
                                <Badge variant="outline" className="text-[10px]">
                                    {profile?.ios_devices ?? 0} paired
                                </Badge>
                            </h4>
                            <p className="text-[11px] text-muted-foreground">
                                Install the OpenQnt app, open it, and paste a pairing token. The AI
                                can then ring the phone via WebRTC instead of placing a normal call.
                            </p>
                        </div>
                    </div>
                    {pairingToken ? (
                        <div className="rounded-md border border-border/60 bg-muted/30 p-3 flex items-center gap-2">
                            <code className="font-mono text-xs flex-1 truncate select-all">
                                {pairingToken}
                            </code>
                            <Button size="sm" variant="outline" onClick={handleCopyToken} className="gap-1.5">
                                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                {copied ? 'Copied' : 'Copy'}
                            </Button>
                        </div>
                    ) : (
                        <Button onClick={handlePair} variant="outline" className="w-full">
                            Generate pairing token
                        </Button>
                    )}
                    {pairingExpiresAt && (
                        <p className="text-[10px] text-muted-foreground">
                            Expires {new Date(pairingExpiresAt).toLocaleTimeString()}.
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Recent calls */}
            <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                    <History className="w-3.5 h-3.5 text-primary" />
                    Recent calls
                    <Badge variant="outline" className="text-[10px] font-normal ml-1">
                        {calls.length}
                    </Badge>
                </div>
                {calls.length === 0 ? (
                    <Card className="bg-card/40 border-dashed border-border/60">
                        <CardContent className="p-6 text-center">
                            <Phone className="w-6 h-6 mx-auto mb-1.5 text-muted-foreground/60" />
                            <p className="text-xs text-muted-foreground">No calls yet.</p>
                        </CardContent>
                    </Card>
                ) : (
                    <Card className="bg-card border-border/60">
                        <CardContent className="p-0 divide-y divide-border/40">
                            {calls.map((c) => (
                                <Label
                                    key={c.id}
                                    className="flex items-center gap-3 p-3 text-xs hover:bg-muted/30 transition-colors"
                                >
                                    <Badge variant="outline" className="text-[10px] uppercase">
                                        {c.transport.replace('_webrtc', '')}
                                    </Badge>
                                    <span className="text-muted-foreground tabular-nums shrink-0">
                                        {new Date(c.started_at).toLocaleString(undefined, {
                                            month: 'short', day: 'numeric',
                                            hour: '2-digit', minute: '2-digit',
                                        })}
                                    </span>
                                    <span className="font-mono tabular-nums shrink-0">
                                        {formatDuration(c.duration_s)}
                                    </span>
                                    <span className="text-muted-foreground italic flex-1 truncate">
                                        {c.error ? `error: ${c.error}` : c.trigger_source}
                                    </span>
                                </Label>
                            ))}
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
};
