/**
 * ProfileModal — user profile, saved strategies, credentials.
 *
 * Restyled to follow the rest of the app: token-driven colours, shadcn
 * primitives, removed hardcoded purple/secondary so it follows the
 * active theme (Architectural Clarity light / Night Style bloomberg /
 * dark / hi-contrast).
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WindowModal } from './WindowModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUserProfile, SavedStrategy } from '@/hooks/useUserProfile';
import { useStrategyFlowStore } from '../../store/strategyFlowStore';
import { api } from '@/services/api';
import { toast } from 'sonner';
import {
  User,
  FolderOpen,
  Trash2,
  Clock,
  LogOut,
  LogIn,
  Save,
  Upload,
  TrendingUp,
  Settings,
  ExternalLink,
  Key,
  Mail,
  ShieldCheck,
  Phone,
} from 'lucide-react';
import { CredentialsTab } from './CredentialsTab';
import { VoiceTab } from './VoiceTab';
import { cn } from '@/lib/utils';

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProfileModal = ({ open, onOpenChange }: ProfileModalProps) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [saveStrategyName, setSaveStrategyName] = useState('');
  const navigate = useNavigate();

  const {
    user,
    isLoggedIn,
    login,
    logout,
    savedStrategies,
    saveStrategy,
    deleteStrategy,
  } = useUserProfile();

  const { strategyName, importStrategy } = useStrategyFlowStore();

  const handleLogin = async () => {
    if (loginEmail.trim() && loginPassword.trim()) {
      try {
        await login(loginEmail.trim(), loginPassword.trim());
        setLoginPassword('');
        setLoginEmail('');
        toast.success('Login successful');
      } catch (e) {
        toast.error('Login failed: ' + e);
      }
    }
  };

  const handleSaveStrategy = async () => {
    const name = saveStrategyName.trim() || strategyName;
    const { nodes, edges } = useStrategyFlowStore.getState();
    if (nodes && edges) {
      await saveStrategy(name, nodes, edges);
      setSaveStrategyName('');
      toast.success('Strategy saved');
    }
  };

  const handleLoadStrategy = async (saved: SavedStrategy) => {
    try {
      const response = await api.getStrategy(saved.id);
      if (response.strategy) {
        const { nodes, edges } = response.strategy;
        importStrategy(JSON.stringify({
          version: '1.0',
          name: saved.name,
          nodes,
          edges,
        }));
        toast.success(`Loaded: ${saved.name}`);
        onOpenChange(false);
      }
    } catch {
      toast.error('Failed to load strategy');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const initials = (user?.name || user?.email || 'U').slice(0, 1).toUpperCase();

  return (
    <WindowModal
      open={open}
      onOpenChange={onOpenChange}
      title="Profile"
      icon={<User className="w-5 h-5" />}
      defaultWidth={620}
      defaultHeight={560}
      minWidth={460}
      minHeight={380}
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        <TabsList className="mx-4 mt-3 bg-muted/40 border border-border/60 self-start">
          <TabsTrigger value="profile" className="flex items-center gap-1.5 text-xs">
            <User className="w-3.5 h-3.5" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="strategies" className="flex items-center gap-1.5 text-xs">
            <FolderOpen className="w-3.5 h-3.5" />
            Strategies
          </TabsTrigger>
          <TabsTrigger value="credentials" className="flex items-center gap-1.5 text-xs">
            <Key className="w-3.5 h-3.5" />
            Credentials
          </TabsTrigger>
          <TabsTrigger value="voice" className="flex items-center gap-1.5 text-xs">
            <Phone className="w-3.5 h-3.5" />
            Voice
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1">
          <div className="p-5">
            {/* ─── Profile tab ──────────────────────────────────────── */}
            <TabsContent value="profile" className="m-0 space-y-5">
              {isLoggedIn ? (
                <>
                  {/* Identity card */}
                  <Card className="bg-card border-border/60">
                    <CardContent className="p-5 flex items-start gap-4">
                      <div
                        className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xl font-semibold shrink-0 shadow-sm"
                        aria-hidden
                      >
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-base truncate">
                            {user?.name || user?.email?.split('@')[0]}
                          </h3>
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                            <ShieldCheck className="w-3 h-3 mr-1 text-profit" />
                            Verified
                          </Badge>
                        </div>
                        <p className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5 truncate">
                          <Mail className="w-3.5 h-3.5 shrink-0" />
                          {user?.email}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-1.5">
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

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-3">
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
                    <button
                      onClick={() => { onOpenChange(false); navigate('/settings'); }}
                      className="rounded-lg border border-border/60 bg-card p-3 text-left hover:border-border hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                        <Settings className="w-3 h-3" />
                        Settings
                      </div>
                      <div className="text-sm font-semibold mt-1 flex items-center gap-1">
                        Open <ExternalLink className="w-3 h-3 text-muted-foreground" />
                      </div>
                    </button>
                  </div>
                </>
              ) : (
                <Card className="bg-card border-border/60">
                  <CardContent className="p-6 max-w-sm mx-auto">
                    <div className="text-center mb-5">
                      <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
                        <User className="w-7 h-7 text-primary" />
                      </div>
                      <h3 className="text-base font-semibold">Sign in to OpenQnt</h3>
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
              )}
            </TabsContent>

            {/* ─── Strategies tab ──────────────────────────────────── */}
            <TabsContent value="strategies" className="m-0 space-y-4">
              <Card className="bg-card border-border/60">
                <CardContent className="p-4 space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Save className="w-3.5 h-3.5 text-primary" />
                    Save current strategy
                  </h4>
                  <div className="flex gap-2">
                    <Input
                      value={saveStrategyName}
                      onChange={(e) => setSaveStrategyName(e.target.value)}
                      placeholder={strategyName}
                      className="flex-1"
                    />
                    <Button onClick={handleSaveStrategy} className="gap-1.5">
                      <Save className="w-3.5 h-3.5" />
                      Save
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-2">
                  <FolderOpen className="w-3.5 h-3.5 text-primary" />
                  Saved strategies
                  <Badge variant="outline" className="text-[10px] font-normal ml-1">
                    {savedStrategies.length}
                  </Badge>
                </h4>
                {savedStrategies.length === 0 ? (
                  <Card className="bg-card/40 border-dashed border-border/60">
                    <CardContent className="p-8 text-center">
                      <FolderOpen className="w-8 h-8 mx-auto mb-2 text-muted-foreground/60" />
                      <p className="text-sm text-muted-foreground">No saved strategies yet.</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="bg-card border-border/60">
                    <CardContent className="p-0 divide-y divide-border/40">
                      {savedStrategies.map((strategy) => (
                        <div
                          key={strategy.id}
                          className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors"
                        >
                          <div className="w-8 h-8 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                            <FolderOpen className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{strategy.name}</div>
                            <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />
                              {formatDate(strategy.savedAt)}
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleLoadStrategy(strategy)}
                            className="gap-1 shrink-0"
                          >
                            <Upload className="w-3 h-3" />
                            Load
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteStrategy(strategy.id)}
                            className={cn(
                              'shrink-0 w-8 h-8',
                              'text-muted-foreground hover:text-loss hover:bg-loss/10',
                            )}
                            aria-label={`Delete ${strategy.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* ─── Credentials tab ─────────────────────────────────── */}
            <TabsContent value="credentials" className="m-0">
              <CredentialsTab />
            </TabsContent>

            {/* ─── Voice tab ───────────────────────────────────────── */}
            <TabsContent value="voice" className="m-0">
              <VoiceTab userId={user?.id ?? null} />
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </WindowModal>
  );
};

const StatCard = ({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) => (
  <div className="rounded-lg border border-border/60 bg-card p-3">
    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
      {icon}
      {label}
    </div>
    <div className="text-2xl font-semibold tabular-nums leading-tight mt-1">{value}</div>
  </div>
);

export default ProfileModal;
