import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Link2, Power, TrendingUp, TrendingDown, AlertCircle, CheckCircle2, X, Play, Square } from "lucide-react";
import { toast } from "sonner";

interface Position {
    dealId: string;
    epic: string;
    direction: string;
    size: number;
    openLevel: number;
    profit: number;
}

interface IGTradingPanelProps {
    onClose?: () => void;
    getWorkspaceXml?: () => string | null;
}

export const IGTradingPanel = ({ onClose, getWorkspaceXml }: IGTradingPanelProps) => {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [positions, setPositions] = useState<Position[]>([]);
    const [accountId, setAccountId] = useState<string | null>(null);

    // Credentials
    const [apiKey, setApiKey] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    // Trade form
    const [symbol, setSymbol] = useState("EURUSD");
    const [direction, setDirection] = useState<"BUY" | "SELL">("BUY");
    const [size, setSize] = useState("0.5");
    const [isTrading, setIsTrading] = useState(false);

    // Strategy runner
    const [isStrategyRunning, setIsStrategyRunning] = useState(false);
    const [isStartingStrategy, setIsStartingStrategy] = useState(false);
    const [strategyStatus, setStrategyStatus] = useState<any>(null);

    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

    const handleConnect = async () => {
        if (!apiKey || !username || !password) {
            toast.error("Missing credentials", {
                description: "Please enter API key, username, and password",
            });
            return;
        }

        setIsConnecting(true);
        try {
            const response = await fetch(`${backendUrl}/ig/login`, {
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
                setIsConnected(true);
                setAccountId(data.account_id);
                toast.success("Connected to IG", {
                    description: `Account: ${data.account_id}`,
                });
                fetchPositions();
            } else {
                toast.error("Connection failed", {
                    description: data.error || data.detail || "Invalid credentials",
                });
            }
        } catch (error) {
            toast.error("Connection error", {
                description: "Backend not running? Start with: uvicorn main:app --port 8000",
            });
        } finally {
            setIsConnecting(false);
        }
    };

    const fetchPositions = async () => {
        try {
            const response = await fetch(`${backendUrl}/ig/positions`);
            const data = await response.json();
            if (data.success && data.positions) {
                setPositions(data.positions);
            }
        } catch (error) {
            console.error("Failed to fetch positions:", error);
        }
    };

    const handleTrade = async () => {
        setIsTrading(true);
        try {
            const response = await fetch(`${backendUrl}/ig/trade`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    symbol,
                    direction,
                    size: parseFloat(size),
                }),
            });

            const data = await response.json();

            if (data.success) {
                toast.success(`${direction} order placed!`, {
                    description: `${symbol} @ ${size} lots`,
                });
                fetchPositions();
            } else {
                toast.error("Trade failed", {
                    description: data.error,
                });
            }
        } catch (error) {
            toast.error("Trade error", {
                description: "Failed to execute trade",
            });
        } finally {
            setIsTrading(false);
        }
    };

    const handleClosePosition = async (dealId: string) => {
        try {
            const response = await fetch(`${backendUrl}/ig/position/${dealId}`, {
                method: "DELETE",
            });

            const data = await response.json();

            if (data.success) {
                toast.success("Position closed");
                fetchPositions();
            } else {
                toast.error("Failed to close position", {
                    description: data.error,
                });
            }
        } catch (error) {
            toast.error("Error closing position");
        }
    };

    // Poll positions while connected
    useEffect(() => {
        if (isConnected) {
            const interval = setInterval(fetchPositions, 10000);
            return () => clearInterval(interval);
        }
    }, [isConnected]);

    // Poll strategy status
    useEffect(() => {
        if (isStrategyRunning) {
            const interval = setInterval(async () => {
                try {
                    const response = await fetch(`${backendUrl}/strategy/status`);
                    const data = await response.json();
                    if (data.success && data.status) {
                        setStrategyStatus(data.status);
                    }
                } catch (e) {
                    console.error("Failed to fetch strategy status", e);
                }
            }, 5000);
            return () => clearInterval(interval);
        }
    }, [isStrategyRunning]);

    const handleStartStrategy = async () => {
        if (!getWorkspaceXml) {
            toast.error("No workspace XML getter provided");
            return;
        }
        const xml = getWorkspaceXml();
        if (!xml) {
            toast.error("Add blocks to workspace first");
            return;
        }

        setIsStartingStrategy(true);
        try {
            const response = await fetch(`${backendUrl}/strategy/start`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workspaceXml: xml,
                    symbol,
                    tradeSize: parseFloat(size),
                    pollInterval: 60
                }),
            });
            const data = await response.json();
            if (data.success) {
                setIsStrategyRunning(true);
                setStrategyStatus(data.status);
                toast.success("Strategy started!", {
                    description: `Running on ${symbol}`
                });
            } else {
                toast.error("Failed to start", { description: data.error });
            }
        } catch (e) {
            toast.error("Error starting strategy");
        } finally {
            setIsStartingStrategy(false);
        }
    };

    const handleStopStrategy = async () => {
        try {
            const response = await fetch(`${backendUrl}/strategy/stop`, {
                method: "POST",
            });
            const data = await response.json();
            if (data.success) {
                setIsStrategyRunning(false);
                setStrategyStatus(null);
                toast.success("Strategy stopped");
            }
        } catch (e) {
            toast.error("Error stopping strategy");
        }
    };

    return (
        <Card className="w-[400px] border-l border-border bg-card flex flex-col animate-in slide-in-from-right duration-300 shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                    IG Trading
                </CardTitle>
                <div className="flex items-center gap-2">
                    {isConnected ? (
                        <Badge variant="default" className="bg-green-500">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Connected
                        </Badge>
                    ) : (
                        <Badge variant="secondary">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            Disconnected
                        </Badge>
                    )}
                    {onClose && (
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                            <X className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </CardHeader>

            <CardContent className="flex-1 space-y-4 overflow-auto">
                {/* Connection Section */}
                {!isConnected && (
                    <div className="space-y-3">
                        <div className="text-center mb-2">
                            <Link2 className="w-6 h-6 mx-auto text-muted-foreground mb-2" />
                            <p className="text-sm text-muted-foreground">
                                Enter your IG Demo credentials
                            </p>
                        </div>

                        <div className="space-y-2">
                            <div className="space-y-1">
                                <Label className="text-xs">API Key</Label>
                                <Input
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    placeholder="Your IG API key"
                                    className="text-sm"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Username</Label>
                                <Input
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Your IG username"
                                    className="text-sm"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs">Password</Label>
                                <Input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Your IG password"
                                    className="text-sm"
                                />
                            </div>
                        </div>

                        <Button onClick={handleConnect} disabled={isConnecting} className="w-full">
                            {isConnecting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Connecting...
                                </>
                            ) : (
                                <>
                                    <Power className="w-4 h-4 mr-2" />
                                    Connect to IG Demo
                                </>
                            )}
                        </Button>
                        <p className="text-xs text-muted-foreground text-center">
                            Get API key from{" "}
                            <a href="https://labs.ig.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                                labs.ig.com
                            </a>
                        </p>
                    </div>
                )}

                {/* Trade Form */}
                {isConnected && (
                    <>
                        <div className="space-y-3">
                            <div className="space-y-1">
                                <Label className="text-xs">Symbol</Label>
                                <select
                                    value={symbol}
                                    onChange={(e) => setSymbol(e.target.value)}
                                    className="w-full h-9 rounded-md border bg-background px-3 text-sm"
                                >
                                    <option value="EURUSD">EUR/USD</option>
                                    <option value="GBPUSD">GBP/USD</option>
                                    <option value="USDJPY">USD/JPY</option>
                                    <option value="XAUUSD">XAU/USD (Gold)</option>
                                    <option value="BTCUSD">BTC/USD</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <Label className="text-xs">Direction</Label>
                                    <div className="flex gap-1">
                                        <Button
                                            variant={direction === "BUY" ? "default" : "outline"}
                                            size="sm"
                                            className={direction === "BUY" ? "bg-green-600 hover:bg-green-700 flex-1" : "flex-1"}
                                            onClick={() => setDirection("BUY")}
                                        >
                                            <TrendingUp className="w-3 h-3 mr-1" />
                                            BUY
                                        </Button>
                                        <Button
                                            variant={direction === "SELL" ? "default" : "outline"}
                                            size="sm"
                                            className={direction === "SELL" ? "bg-red-600 hover:bg-red-700 flex-1" : "flex-1"}
                                            onClick={() => setDirection("SELL")}
                                        >
                                            <TrendingDown className="w-3 h-3 mr-1" />
                                            SELL
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Size (lots)</Label>
                                    <Input
                                        value={size}
                                        onChange={(e) => setSize(e.target.value)}
                                        type="number"
                                        step="0.1"
                                        min="0.1"
                                    />
                                </div>
                            </div>

                            <Button
                                onClick={handleTrade}
                                disabled={isTrading}
                                className={`w-full ${direction === "BUY" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"}`}
                            >
                                {isTrading ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : direction === "BUY" ? (
                                    <TrendingUp className="w-4 h-4 mr-2" />
                                ) : (
                                    <TrendingDown className="w-4 h-4 mr-2" />
                                )}
                                {direction} {symbol}
                            </Button>
                        </div>

                        {/* Strategy Runner Section */}
                        <div className="space-y-3 pt-3 border-t border-border">
                            <Label className="text-xs font-medium">Auto-Trade Strategy</Label>

                            {isStrategyRunning ? (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <Badge className="bg-purple-500 animate-pulse">
                                            <Play className="w-3 h-3 mr-1" />
                                            Running
                                        </Badge>
                                        <span className="text-xs text-muted-foreground">
                                            {strategyStatus?.symbol || symbol}
                                        </span>
                                    </div>

                                    {strategyStatus && (
                                        <div className="text-xs space-y-1 bg-muted p-2 rounded">
                                            <div>Position: {strategyStatus.current_position || 'None'}</div>
                                            <div>Last Signal: {strategyStatus.last_signal || 'None'}</div>
                                            <div>Trades: {strategyStatus.trade_count || 0}</div>
                                            {strategyStatus.last_price && (
                                                <div>Last Price: {strategyStatus.last_price.toFixed(5)}</div>
                                            )}
                                        </div>
                                    )}

                                    <Button
                                        onClick={handleStopStrategy}
                                        variant="destructive"
                                        className="w-full"
                                    >
                                        <Square className="w-4 h-4 mr-2" />
                                        Stop Strategy
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-xs text-muted-foreground">
                                        Run your Blockly strategy automatically
                                    </p>
                                    <Button
                                        onClick={handleStartStrategy}
                                        disabled={isStartingStrategy}
                                        className="w-full bg-purple-600 hover:bg-purple-700"
                                    >
                                        {isStartingStrategy ? (
                                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        ) : (
                                            <Play className="w-4 h-4 mr-2" />
                                        )}
                                        Run Strategy
                                    </Button>
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-medium">Open Positions</Label>
                                <Button variant="ghost" size="sm" onClick={fetchPositions} className="h-6 text-xs">
                                    Refresh
                                </Button>
                            </div>

                            {positions.length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-4">
                                    No open positions
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {positions.map((pos) => (
                                        <div
                                            key={pos.dealId}
                                            className="flex items-center justify-between p-2 bg-muted rounded-md text-xs"
                                        >
                                            <div>
                                                <span className="font-medium">{pos.epic}</span>
                                                <span className={`ml-2 ${pos.direction === "BUY" ? "text-green-500" : "text-red-500"}`}>
                                                    {pos.direction}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={pos.profit >= 0 ? "text-green-500" : "text-red-500"}>
                                                    ${pos.profit?.toFixed(2) || "0.00"}
                                                </span>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    onClick={() => handleClosePosition(pos.dealId)}
                                                >
                                                    <X className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
};
