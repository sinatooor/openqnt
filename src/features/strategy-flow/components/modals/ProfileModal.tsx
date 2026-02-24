/**
 * ProfileModal - User profile management for Strategy Flow
 * Features: Login/Logout, User Info, Saved Strategies, Settings, Broker Connections
 */

import { useState } from 'react';
import { WindowModal } from './WindowModal';
import { BrokerConnectionModal } from './BrokerConnectionModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useUserProfile, SavedStrategy } from '@/hooks/useUserProfile';
import { useStrategyFlowStore } from '../../store/strategyFlowStore';
import { api } from '@/services/api';
import { toast } from 'sonner';
import {
  User,
  FolderOpen,
  Settings,
  Link2,
  Trash2,
  Clock,
  LogOut,
  LogIn,
  Save,
  Upload,
  Mail,
  CheckCircle,
  XCircle,
  Wallet,
  TrendingUp,
  Shield,
} from 'lucide-react';

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Broker list with logos
const BROKERS = [
  { id: 'ig', name: 'IG Markets', description: 'CFD Trading', logo: '/logo/logo_ig.png' },
  { id: 'icmarkets', name: 'IC Markets', description: 'Forex & CFDs', logo: '/logo/logo_icmarkets.png' },
  { id: 'ibkr', name: 'Interactive Brokers', description: 'Global Markets', logo: '/logo/interactivebrokers.png' },
  { id: 'nordnet', name: 'Nordnet', description: 'Nordic Broker', logo: '/logo/nordnet.png' },
  { id: 'avanza', name: 'Avanza', description: 'Swedish Stockbroker', logo: '/logo/avanza.png' },
  { id: 'etoro', name: 'eToro', description: 'Social Trading', logo: '/logo/logo_etoro.png' },
];

// Connectors list
const CONNECTORS = [
  { id: 'tradingview', name: 'TradingView', description: 'Charting & Alerts', logo: '/logo/logo_tradingview.webp' },
  { id: 'discord', name: 'Discord Bot', description: 'Notifications', logo: '/logo/logo_discord_small.png' },
  { id: 'n8n', name: 'n8n', description: 'Workflow automation', logo: '/logo/logo_n8n.png' },
];

export const ProfileModal = ({ open, onOpenChange }: ProfileModalProps) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [saveStrategyName, setSaveStrategyName] = useState('');
  const [brokerConnections, setBrokerConnections] = useState<Record<string, boolean>>({});
  const [selectedBroker, setSelectedBroker] = useState<{id: string, name: string} | null>(null);

  const {
    user,
    isLoggedIn,
    login,
    logout,
    savedStrategies,
    saveStrategy,
    deleteStrategy,
    settings,
    updateSettings,
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
      // Fetch full strategy from API
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
    } catch (e) {
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

  const handleConnectBroker = (brokerId: string) => {
    const broker = BROKERS.find(b => b.id === brokerId);
    if (broker) {
      setSelectedBroker({ id: broker.id, name: broker.name });
    }
  };

  return (
    <>
    <WindowModal
      open={open}
      onOpenChange={onOpenChange}
      title="Profile & Settings"
      icon={<User className="w-5 h-5" />}
      defaultWidth={700}
      defaultHeight={600}
      minWidth={500}
      minHeight={400}
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          <TabsList className="mx-4 mt-2 bg-secondary border border-border">
            <TabsTrigger value="profile" className="flex items-center gap-1.5 data-[state=active]:bg-purple-600">
              <User className="w-3.5 h-3.5" />
              Profile
            </TabsTrigger>
            <TabsTrigger value="strategies" className="flex items-center gap-1.5 data-[state=active]:bg-purple-600">
              <FolderOpen className="w-3.5 h-3.5" />
              Strategies
            </TabsTrigger>
            <TabsTrigger value="brokers" className="flex items-center gap-1.5 data-[state=active]:bg-purple-600">
              <Wallet className="w-3.5 h-3.5" />
              Brokers
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-1.5 data-[state=active]:bg-purple-600">
              <Settings className="w-3.5 h-3.5" />
              Settings
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 p-6">
            {/* Profile Tab */}
            <TabsContent value="profile" className="m-0 space-y-6">
              {isLoggedIn ? (
                <div className="space-y-6">
                  <div className="flex items-center gap-4 p-4 bg-secondary rounded-lg border border-border">
                    <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-2xl font-bold">
                      {user?.email?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{user?.email}</h3>
                      <p className="text-sm text-muted-foreground">Member since {formatDate(user?.createdAt || new Date().toISOString())}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={logout}
                      className="ml-auto border-border"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-4 bg-secondary rounded-lg border border-border text-center">
                      <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-400" />
                      <div className="text-2xl font-bold">{savedStrategies.length}</div>
                      <div className="text-sm text-muted-foreground">Strategies</div>
                    </div>
                    <div className="p-4 bg-secondary rounded-lg border border-border text-center">
                      <Shield className="w-8 h-8 mx-auto mb-2 text-blue-400" />
                      <div className="text-2xl font-bold">{Object.values(brokerConnections).filter(Boolean).length}</div>
                      <div className="text-sm text-muted-foreground">Brokers</div>
                    </div>
                    <div className="p-4 bg-secondary rounded-lg border border-border text-center">
                      <Link2 className="w-8 h-8 mx-auto mb-2 text-purple-400" />
                      <div className="text-2xl font-bold">0</div>
                      <div className="text-sm text-muted-foreground">Integrations</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 max-w-sm mx-auto">
                  <div className="text-center mb-6">
                    <User className="w-16 h-16 mx-auto mb-4 text-white/20" />
                    <h3 className="text-lg font-semibold">Sign In</h3>
                    <p className="text-sm text-muted-foreground">Sign in to save strategies and connect brokers</p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-muted-foreground">Email</Label>
                      <Input
                        type="email"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="bg-secondary border-border"
                      />
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Password</Label>
                      <Input
                        type="password"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="bg-secondary border-border"
                        onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                      />
                    </div>
                    <Button onClick={handleLogin} className="w-full bg-purple-600 hover:bg-purple-700">
                      <LogIn className="w-4 h-4 mr-2" />
                      Sign In
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Strategies Tab */}
            <TabsContent value="strategies" className="m-0 space-y-4">
              {/* Save Current Strategy */}
              <div className="p-4 bg-secondary rounded-lg border border-border">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Save className="w-4 h-4 text-purple-400" />
                  Save Current Strategy
                </h4>
                <div className="flex gap-2">
                  <Input
                    value={saveStrategyName}
                    onChange={(e) => setSaveStrategyName(e.target.value)}
                    placeholder={strategyName}
                    className="flex-1 bg-background border-border"
                  />
                  <Button onClick={handleSaveStrategy} className="bg-purple-600 hover:bg-purple-700">
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                </div>
              </div>

              <Separator className="bg-border" />

              {/* Saved Strategies List */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-blue-400" />
                  Saved Strategies ({savedStrategies.length})
                </h4>
                {savedStrategies.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>No saved strategies yet</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {savedStrategies.map((strategy) => (
                      <div
                        key={strategy.id}
                        className="flex items-center gap-3 p-3 bg-secondary rounded-lg border border-border hover:border-primary/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="font-medium">{strategy.name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(strategy.savedAt)}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleLoadStrategy(strategy)}
                          className="border-border"
                        >
                          <Upload className="w-3.5 h-3.5 mr-1" />
                          Load
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteStrategy(strategy.id)}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Brokers Tab */}
            <TabsContent value="brokers" className="m-0 space-y-4">
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-green-400" />
                  Trading Brokers
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {BROKERS.map((broker) => (
                    <div
                      key={broker.id}
                      className="flex items-center gap-3 p-3 bg-secondary rounded-lg border border-border"
                    >
                      <img
                        src={broker.logo}
                        alt={broker.name}
                        className="w-10 h-10 rounded object-contain bg-white/5 p-1"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder.svg';
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{broker.name}</div>
                        <div className="text-xs text-muted-foreground">{broker.description}</div>
                      </div>
                      {brokerConnections[broker.id] ? (
                        <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Connected
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleConnectBroker(broker.id)}
                          className="border-border text-xs"
                        >
                          Connect
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Separator className="bg-border" />

              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-purple-400" />
                  Integrations
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {CONNECTORS.map((connector) => (
                    <div
                      key={connector.id}
                      className="flex items-center gap-3 p-3 bg-secondary rounded-lg border border-border"
                    >
                      <img
                        src={connector.logo}
                        alt={connector.name}
                        className="w-10 h-10 rounded object-contain bg-white/5 p-1"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder.svg';
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{connector.name}</div>
                        <div className="text-xs text-muted-foreground">{connector.description}</div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-border text-xs"
                      >
                        Setup
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="m-0 space-y-4">
              <div className="space-y-4">
                <div className="p-4 bg-secondary rounded-lg border border-border">
                  <h4 className="font-medium mb-3">Default Trading Settings</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground text-sm">Default Symbol</Label>
                      <Input
                        type="text"
                        defaultValue={settings?.defaultSymbol || 'EURUSD'}
                        onChange={(e) => updateSettings({ defaultSymbol: e.target.value })}
                        className="bg-background border-border"
                      />
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-sm">Default Timeframe</Label>
                      <Input
                        type="text"
                        defaultValue={settings?.defaultTimeframe || '1H'}
                        onChange={(e) => updateSettings({ defaultTimeframe: e.target.value })}
                        className="bg-background border-border"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-secondary rounded-lg border border-border">
                  <h4 className="font-medium mb-3">Preferences</h4>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        defaultChecked={settings?.autoSave ?? true}
                        onChange={(e) => updateSettings({ autoSave: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-sm">Auto-save strategies</span>
                    </label>
                  </div>
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
    </WindowModal>

    {selectedBroker && (
      <BrokerConnectionModal
        open={!!selectedBroker}
        onOpenChange={(open) => !open && setSelectedBroker(null)}
        brokerId={selectedBroker.id}
        brokerName={selectedBroker.name}
        onConnected={() => {
          setBrokerConnections(prev => ({ ...prev, [selectedBroker.id]: true }));
        }}
      />
    )}
    </>
  );
};

export default ProfileModal;
