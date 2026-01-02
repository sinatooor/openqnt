import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

interface BrokerConnectModalProps {
    isOpen: boolean;
    onClose: () => void;
    broker: {
        id: string;
        name: string;
        logo: string;
        description?: string;
    } | null;
    onConnect?: (brokerId: string, credentials: any) => Promise<boolean>;
    onSuccess?: (brokerId: string) => void;
}

export const BrokerConnectModal = ({ isOpen, onClose, broker, onConnect, onSuccess }: BrokerConnectModalProps) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isDemo, setIsDemo] = useState(true);

    // Form States
    const [apiKey, setApiKey] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [accountId, setAccountId] = useState("");
    const [secretKey, setSecretKey] = useState("");
    const [privateKey, setPrivateKey] = useState("");

    if (!broker) return null;

    const handleConnect = async () => {
        setIsLoading(true);
        try {
            // Construct credentials based on broker type
            let credentials: any = { isDemo };

            if (broker.id === 'ig') {
                if (!apiKey || !username || !password) {
                    toast.error("Missing required fields");
                    setIsLoading(false);
                    return;
                }
                credentials = { ...credentials, apiKey, username, password };
            } else if (broker.id === 'oanda') {
                credentials = { ...credentials, accountId, accessToken: apiKey };
            } else if (broker.id === 'nordnet') {
                if (!apiKey || !privateKey) {
                    toast.error("Missing required fields");
                    setIsLoading(false);
                    return;
                }
                credentials = { ...credentials, apiKey, privateKey };
            } else if (['binance', 'coinbase', 'kraken'].includes(broker.id)) {
                credentials = { ...credentials, apiKey, secretKey };
            } else {
                credentials = { ...credentials, apiKey, username, password }; // Generic fallback
            }

            // Call parent handler or default backend mock
            if (onConnect) {
                const success = await onConnect(broker.id, credentials);
                if (success) onClose();
            } else {
                // If no handler provided, simulate generic backend call or specific for IG/Nordnet
                if (broker.id === 'ig') {
                    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/api/live/login`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            api_key: apiKey,
                            username: username,
                            password: password,
                        }),
                    });
                    const data = await response.json();
                    if (data.success) {
                        toast.success(`Connected to ${broker.name}`);
                        if (onSuccess) onSuccess(broker.id);
                        onClose();
                    } else {
                        toast.error("Connection failed", { description: data.error || data.detail });
                    }
                } else if (broker.id === 'nordnet') {
                    const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/api/live/nordnet/login`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            api_key: apiKey,
                            private_key: privateKey,
                        }),
                    });
                    const data = await response.json();
                    if (data.success) {
                        toast.success(`Connected to ${broker.name}`);
                        if (onSuccess) onSuccess(broker.id);
                        onClose();
                    } else {
                        toast.error("Connection failed", { description: data.error || data.detail });
                    }
                } else {
                    // Simulate connection for others
                    await new Promise(r => setTimeout(r, 1500));
                    toast.success(`Connected to ${broker.name} (Simulation)`);
                    if (onSuccess) onSuccess(broker.id);
                    onClose();
                }
            }
        } catch (error) {
            toast.error("Connection error");
        } finally {
            setIsLoading(false);
        }
    };

    const renderFields = () => {
        switch (broker.id) {
            case 'ig':
                return (
                    <>
                        <div className="space-y-2">
                            <Label>API Key</Label>
                            <Input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="IG API Key" />
                        </div>
                        <div className="space-y-2">
                            <Label>Username</Label>
                            <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="IG Username" />
                        </div>
                        <div className="space-y-2">
                            <Label>Password</Label>
                            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="IG Password" />
                        </div>
                    </>
                );
            case 'oanda':
                return (
                    <>
                        <div className="space-y-2">
                            <Label>Account ID</Label>
                            <Input value={accountId} onChange={e => setAccountId(e.target.value)} placeholder="001-001-..." />
                        </div>
                        <div className="space-y-2">
                            <Label>Access Token</Label>
                            <Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Personal Access Token" />
                        </div>
                    </>
                );
            case 'interactivebrokers':
                return (
                    <div className="text-center py-4 space-y-2">
                        <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto" />
                        <p className="text-sm text-muted-foreground">Interactive Brokers requires running TWS or IB Gateway locally.</p>
                        <div className="space-y-2 text-left mt-4">
                            <Label>Host IP</Label>
                            <Input defaultValue="127.0.0.1" placeholder="127.0.0.1" />
                        </div>
                        <div className="space-y-2 text-left">
                            <Label>Port</Label>
                            <Input defaultValue="7497" placeholder="7497 (Paper) / 7496 (Live)" />
                        </div>
                    </div>
                );
            case 'binance':
            case 'kraken':
                return (
                    <>
                        <div className="space-y-2">
                            <Label>API Key</Label>
                            <Input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Exchange API Key" />
                        </div>
                        <div className="space-y-2">
                            <Label>Secret Key</Label>
                            <Input type="password" value={secretKey} onChange={e => setSecretKey(e.target.value)} placeholder="Exchange Secret Key" />
                        </div>
                    </>
                );
            case 'nordnet':
                return (
                    <>
                        <div className="space-y-2">
                            <Label>API / Service ID (UUID)</Label>
                            <Input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Your Nordnet API Key UUID" />
                        </div>
                        <div className="space-y-2">
                            <Label>Private Key (PEM)</Label>
                            <textarea
                                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={privateKey}
                                onChange={e => setPrivateKey(e.target.value)}
                                placeholder="-----BEGIN PRIVATE KEY-----..."
                            />
                            <p className="text-xs text-muted-foreground">Paste your Ed25519 private key content here.</p>
                        </div>
                    </>
                );
            default:
                return (
                    <>
                        <div className="space-y-2">
                            <Label>API Key / Token</Label>
                            <Input value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="API Key" />
                        </div>
                        <div className="space-y-2">
                            <Label>Username (Optional)</Label>
                            <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="Username" />
                        </div>
                    </>
                );
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-md bg-white border flex items-center justify-center p-1">
                            <img src={broker.logo} alt={broker.name} className="w-full h-full object-contain" />
                        </div>
                        <div>
                            <DialogTitle>Connect {broker.name}</DialogTitle>
                            <DialogDescription>{broker.description}</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Demo Account</span>
                            <span className="text-xs text-muted-foreground">(Paper Trading)</span>
                        </div>
                        <Switch checked={isDemo} onCheckedChange={setIsDemo} />
                    </div>

                    {renderFields()}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
                    <Button onClick={handleConnect} disabled={isLoading} className={isLoading ? "w-24" : ""}>
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Connect"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
