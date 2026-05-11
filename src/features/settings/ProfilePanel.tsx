/**
 * Settings → Profile panel.
 *
 * Identity card + signed-in stats, or the sign-in form if no session.
 * Extracted from the old ProfileModal's Profile tab — the modal itself is
 * gone; everything funnels through Settings now.
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  User,
  LogOut,
  LogIn,
  Mail,
  ShieldCheck,
  TrendingUp,
  FolderOpen,
} from 'lucide-react';
import { useUserProfile } from '@/hooks/useUserProfile';

export function ProfilePanel() {
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const { user, isLoggedIn, login, logout, savedStrategies } = useUserProfile();

  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword.trim()) return;
    try {
      await login(loginEmail.trim(), loginPassword.trim());
      setLoginPassword('');
      setLoginEmail('');
      toast.success('Login successful');
    } catch (e) {
      toast.error('Login failed: ' + (e instanceof Error ? e.message : String(e)));
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const initials = (user?.name || user?.email || 'U').slice(0, 1).toUpperCase();

  if (!isLoggedIn) {
    return (
      <Card className="bg-card border-border/60">
        <CardContent className="p-6 max-w-sm">
          <div className="mb-5">
            <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
              <User className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-sm font-semibold">Sign in to OpenQnt</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Save strategies, connect brokers, sync settings.
            </p>
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Email</Label>
              <Input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Password</Label>
              <Input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <Button onClick={handleLogin} className="w-full gap-1.5">
              <LogIn className="w-3.5 h-3.5" />
              Sign in
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Identity card */}
      <Card className="bg-card border-border/60">
        <CardContent className="p-4 flex items-start gap-4">
          <div
            className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-semibold shrink-0 shadow-sm"
            aria-hidden
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm truncate">
                {user?.name || user?.email?.split('@')[0]}
              </h3>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                <ShieldCheck className="w-3 h-3 mr-1 text-profit" />
                Verified
              </Badge>
            </div>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 truncate">
              <Mail className="w-3.5 h-3.5 shrink-0" />
              {user?.email}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Member since {formatDate(user?.createdAt || new Date().toISOString())}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={logout}
            className="shrink-0 gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </Button>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<TrendingUp className="w-4 h-4 text-profit" />}
          label="Strategies"
          value={savedStrategies.length}
        />
        <StatCard
          icon={<FolderOpen className="w-4 h-4 text-primary" />}
          label="Workspaces"
          value={1}
        />
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums leading-tight mt-1">{value}</div>
    </div>
  );
}
