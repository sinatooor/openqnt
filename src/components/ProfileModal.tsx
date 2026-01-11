/**
 * ProfileModal - User profile management modal
 * Features: Login/Logout, User Info, Saved Strategies, Settings, Broker Status
 */

import { useState } from 'react';
import { DraggableModal } from './DraggableModal';
import { BrokerConnectModal } from './BrokerConnectModal';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { cn } from '@/lib/utils';
import { useUserProfile, SavedStrategy } from '@/hooks/useUserProfile';
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
    Blocks,
    Mail,
    CheckCircle,
    XCircle,
} from 'lucide-react';

type TabType = 'profile' | 'strategies' | 'settings' | 'connectors';

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentXml?: string;
    currentStrategyName?: string;
    onLoadStrategy?: (xml: string, name: string) => void;
}

export const ProfileModal = ({
    isOpen,
    onClose,
    currentXml = '',
    currentStrategyName = 'Untitled Strategy',
    onLoadStrategy,
}: ProfileModalProps) => {
    const [activeTab, setActiveTab] = useState<TabType>('profile');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginEmail, setLoginEmail] = useState('');
    const [saveStrategyName, setSaveStrategyName] = useState('');

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

    const handleLogin = async () => {
        if (loginPassword.trim() && loginEmail.trim()) {
            try {
                await login(loginEmail.trim(), loginPassword.trim());
                setLoginPassword('');
                setLoginEmail('');
            } catch (e) {
                alert("Login failed: " + e); // Simple alert for now, or use toast if available
            }
        }
    };

    const handleSaveStrategy = async () => {
        const name = saveStrategyName.trim() || currentStrategyName;
        if (currentXml) {
            await saveStrategy(name, currentXml);
            setSaveStrategyName('');
        }
    };

    const handleLoadStrategy = (strategy: SavedStrategy) => {
        onLoadStrategy?.(strategy.xml, strategy.name);
        onClose();
    };

    const tabs = [
        { id: 'profile' as TabType, label: 'Profile', icon: User },
        { id: 'strategies' as TabType, label: 'Strategies', icon: FolderOpen },
        { id: 'settings' as TabType, label: 'Settings', icon: Settings },
        { id: 'connectors' as TabType, label: 'Connectors', icon: Link2 },
    ];

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    // Connectors List - using logos from /public/logo
    const connectors = [
        { id: 'firecrawl', name: 'Firecrawl', description: 'Web scraping API', logo: '/logo/logo_firecrawl.png', status: 'disconnected' },
        { id: 'n8n', name: 'n8n', description: 'Workflow automation', logo: '/logo/logo_n8n.png', status: 'disconnected' },
        { id: 'discord', name: 'Discord Bot', description: 'Notifications', logo: '/logo/logo_discord_small.png', status: 'disconnected' },
        { id: 'perplexity', name: 'Perplexity', description: 'AI Research', logo: '/logo/logo_perplexity.png', status: 'disconnected' },
        { id: 'tradingview', name: 'TradingView', description: 'Charting & Alerts', logo: '/logo/logo_tradingview.webp', status: 'disconnected' },
    ];

    const [brokers, setBrokers] = useState([
        { id: 'ig', name: 'IG Markets', description: 'CFD Trading', logo: '/logo/logo_ig.png', status: 'disconnected' },
        { id: 'icmarkets', name: 'IC Markets', description: 'Forex & CFDs', logo: '/logo/logo_icmarkets.png', status: 'disconnected' },
        { id: 'etoro', name: 'eToro', description: 'Social Trading', logo: '/logo/logo_etoro.png', status: 'disconnected' },
        { id: 'ibkr', name: 'Interactive Brokers', description: 'Global Markets', logo: '/logo/interactivebrokers.png', status: 'disconnected' },
        { id: 'nordnet', name: 'Nordnet', description: 'Nordic Broker', logo: '/logo/nordnet.png', status: 'disconnected' },
        { id: 'swissquote', name: 'Swissquote', description: 'Banking Group', logo: '/logo/swissquote.png', status: 'disconnected' },
        { id: 'saxo', name: 'Saxo Bank', description: 'Investment', logo: '/logo/saxo.png', status: 'disconnected' },
        { id: 'nordea', name: 'Nordea', description: 'Financial Services', logo: '/logo/nordea.png', status: 'disconnected' },
        { id: 'avanza', name: 'Avanza', description: 'Swedish Stockbroker', logo: '/logo/avanza.png', status: 'disconnected' },
        { id: 'etrade', name: 'E*TRADE', description: 'Electronic Trading', logo: '/logo/etrade.png', status: 'disconnected' },
        { id: 'handelsbanken', name: 'Handelsbanken', description: 'Nordic Bank', logo: '/logo/handelsbanken.png', status: 'disconnected' },
        { id: 'robinhood', name: 'Robinhood', description: 'Commission-free', logo: '/logo/logo_robinhood.png', status: 'disconnected' },
        { id: 'webull', name: 'Webull', description: 'Zero Commission', logo: '/logo/logo_webull.png', status: 'disconnected' },
        { id: 'scm', name: 'Scandinavian Capital Markets', description: 'Forex', logo: '/logo/scandinaviancapitalmarkets.png', status: 'disconnected' },
        { id: 'schwab', name: 'Charles Schwab', description: 'Financial Services', logo: '/logo/schwab.png', status: 'disconnected' },
        { id: 'seb', name: 'SEB', description: 'Nordic Financial', logo: '/logo/seb.png', status: 'disconnected' },
        { id: 'swedbank', name: 'Swedbank', description: 'Nordic Bank', logo: '/logo/swedbank.png', status: 'disconnected' },
    ]);

    // Brokers State
    const [selectedBroker, setSelectedBroker] = useState<{ id: string, name: string, logo: string } | null>(null);

    const handleConnect = (broker: any) => {
        // If it's a tool/connector, keep the old flow or just show alert for now
        // But the broker list is separate.
        // We will assume this function is called for both.
        // If it comes from 'brokers' list, we open modal.
        // If it comes from 'connectors', we might not have modal support yet?
        // Let's assume we open modal for all, but our modal supports generic fields.
        setSelectedBroker(broker);
    };

    return (
        <>
            <DraggableModal
                isOpen={isOpen}
                onClose={onClose}
                title="Profile"
                defaultWidth={700}
                defaultHeight={600}
                minWidth={600}
                minHeight={500}
            >
                {/* ... existing modal content ... */}
                <div className="flex h-full">
                    <div className="w-48 border-r border-border bg-muted/30 p-2 flex flex-col gap-1">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left',
                                    activeTab === tab.id
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                )}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}

                        {isLoggedIn && (
                            <button
                                onClick={logout}
                                className="mt-auto flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                            >
                                <LogOut className="w-4 h-4" />
                                Logout
                            </button>
                        )}
                    </div>

                    <div className="flex-1 p-4 overflow-auto">
                        {/* Profile Tab */}
                        {activeTab === 'profile' && (
                            <div className="space-y-4">
                                {isLoggedIn ? (
                                    <>
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white">
                                                {user?.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-semibold">{user?.name}</h3>
                                                <p className="text-muted-foreground flex items-center gap-1">
                                                    <Mail className="w-3 h-3" />
                                                    {user?.email}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4 mt-6">
                                            <div className="p-4 rounded-lg bg-muted/50 border border-border">
                                                <div className="text-2xl font-bold">{savedStrategies.length}</div>
                                                <div className="text-sm text-muted-foreground">Saved Strategies</div>
                                            </div>
                                            <div className="p-4 rounded-lg bg-muted/50 border border-border">
                                                <div className="text-2xl font-bold">
                                                    {user?.createdAt ? formatDate(user.createdAt).split(',')[0] : '-'}
                                                </div>
                                                <div className="text-sm text-muted-foreground">Member Since</div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="text-center py-6">
                                            <User className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                                            <h3 className="text-lg font-semibold">Welcome to PPM</h3>
                                            <p className="text-muted-foreground text-sm">
                                                Sign in to save your strategies and preferences
                                            </p>
                                        </div>

                                        <div className="space-y-3 max-w-sm mx-auto">
                                            <div>
                                                <Label htmlFor="email">Email</Label>
                                                <Input
                                                    id="email"
                                                    type="email"
                                                    value={loginEmail}
                                                    onChange={(e) => setLoginEmail(e.target.value)}
                                                    placeholder="admin@admin.com"
                                                />
                                            </div>
                                            <div>
                                                <Label htmlFor="password">Password</Label>
                                                <Input
                                                    id="password"
                                                    type="password"
                                                    value={loginPassword}
                                                    onChange={(e) => setLoginPassword(e.target.value)}
                                                    placeholder="••••••••"
                                                />
                                            </div>
                                            <Button className="w-full" onClick={handleLogin}>
                                                <LogIn className="w-4 h-4 mr-2" />
                                                Sign In
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Strategies Tab */}
                        {activeTab === 'strategies' && (
                            <div className="space-y-4">
                                <div className="p-4 rounded-lg border border-border bg-muted/30">
                                    <h4 className="font-medium mb-2">Save Current Strategy</h4>
                                    <div className="flex gap-2">
                                        <Input
                                            value={saveStrategyName}
                                            onChange={(e) => setSaveStrategyName(e.target.value)}
                                            placeholder={currentStrategyName}
                                            className="flex-1"
                                        />
                                        <Button onClick={handleSaveStrategy} disabled={!currentXml}>
                                            <Save className="w-4 h-4 mr-2" />
                                            Save
                                        </Button>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-medium mb-2">Saved Strategies ({savedStrategies.length})</h4>
                                    {savedStrategies.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                            <p>No saved strategies yet</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2 max-h-64 overflow-auto">
                                            {savedStrategies.map((strategy) => (
                                                <div
                                                    key={strategy.id}
                                                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <Blocks className="w-5 h-5 text-primary" />
                                                        <div>
                                                            <div className="font-medium">{strategy.name}</div>
                                                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                                                                <Clock className="w-3 h-3" />
                                                                {formatDate(strategy.savedAt)}
                                                                <span>•</span>
                                                                {strategy.blockCount} blocks
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleLoadStrategy(strategy)}
                                                    >
                                                        <Upload className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => deleteStrategy(strategy.id)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Settings Tab */}
                        {activeTab === 'settings' && (
                            <div className="space-y-4">
                                <div>
                                    <Label>Default Symbol</Label>
                                    <Input
                                        value={settings.defaultSymbol}
                                        onChange={(e) => updateSettings({ defaultSymbol: e.target.value })}
                                        className="mt-1"
                                    />
                                </div>

                                <div>
                                    <Label>Default Timeframe</Label>
                                    <select
                                        value={settings.defaultTimeframe}
                                        onChange={(e) => updateSettings({ defaultTimeframe: e.target.value })}
                                        className="w-full mt-1 h-10 px-3 rounded-md border border-input bg-background"
                                    >
                                        <option value="1M">1 Minute</option>
                                        <option value="5M">5 Minutes</option>
                                        <option value="15M">15 Minutes</option>
                                        <option value="1H">1 Hour</option>
                                        <option value="4H">4 Hours</option>
                                        <option value="1D">1 Day</option>
                                    </select>
                                </div>

                                <div className="flex items-center justify-between">
                                    <div>
                                        <Label>Auto-save Strategies</Label>
                                        <p className="text-xs text-muted-foreground">Automatically save changes</p>
                                    </div>
                                    <button
                                        onClick={() => updateSettings({ autoSave: !settings.autoSave })}
                                        className={cn(
                                            'w-12 h-6 rounded-full transition-colors relative',
                                            settings.autoSave ? 'bg-primary' : 'bg-muted'
                                        )}
                                    >
                                        <div
                                            className={cn(
                                                'w-5 h-5 rounded-full bg-white transition-transform absolute top-0.5',
                                                settings.autoSave ? 'translate-x-6' : 'translate-x-0.5'
                                            )}
                                        />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Connectors Tab */}
                        {activeTab === 'connectors' && (
                            <div className="space-y-6">
                                {/* Tools Section */}
                                <div>
                                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                                        <Blocks className="w-4 h-4 text-primary" />
                                        Tools & Integrations
                                    </h4>
                                    <div className="space-y-2">
                                        {connectors.map((tool) => (
                                            <div key={tool.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-md bg-white flex items-center justify-center overflow-hidden">
                                                        <img src={tool.logo} alt={tool.name} className="w-8 h-8 object-contain" />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium">{tool.name}</div>
                                                        <div className="text-xs text-muted-foreground">{tool.description}</div>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant={tool.status === 'connected' ? "outline" : "default"}
                                                    size="sm"
                                                    onClick={() => handleConnect(tool)}
                                                    className={tool.status === 'connected' ? "text-green-500 border-green-500" : ""}
                                                >
                                                    {tool.status === 'connected' ? (
                                                        <><CheckCircle className="w-4 h-4 mr-1" /> Connected</>
                                                    ) : (
                                                        "Set Up"
                                                    )}
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Brokers Section */}
                                <div>
                                    <h4 className="font-semibold mb-3 flex items-center gap-2">
                                        <Link2 className="w-4 h-4 text-primary" />
                                        Brokers
                                    </h4>
                                    <div className="space-y-2">
                                        {brokers.map((broker) => (
                                            <div key={broker.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-md bg-white flex items-center justify-center overflow-hidden">
                                                        <img src={broker.logo} alt={broker.name} className="w-8 h-8 object-contain" />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium">{broker.name}</div>
                                                        <div className="text-xs text-muted-foreground">{broker.description}</div>
                                                    </div>
                                                </div>
                                                <Button
                                                    variant={broker.status === 'connected' ? "outline" : "default"}
                                                    size="sm"
                                                    onClick={() => handleConnect(broker)}
                                                    className={broker.status === 'connected' ? "text-green-500 border-green-500" : ""}
                                                >
                                                    {broker.status === 'connected' ? (
                                                        <><CheckCircle className="w-4 h-4 mr-1" /> Connected</>
                                                    ) : (
                                                        "Set Up"
                                                    )}
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-blue-500/10 p-3 rounded-lg border border-blue-500/20 text-xs text-muted-foreground flex items-center gap-2">
                                    <span className="font-bold text-blue-500">Tip:</span>
                                    You can ask the AI Assistant to help you connect any of these tools.
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </DraggableModal>

            <BrokerConnectModal
                isOpen={!!selectedBroker}
                onClose={() => setSelectedBroker(null)}
                broker={selectedBroker}
                onSuccess={(id) => {
                    setBrokers(prev => prev.map(b => b.id === id ? { ...b, status: 'connected' } : b));
                }}
            />
        </>
    );
};

export default ProfileModal;
