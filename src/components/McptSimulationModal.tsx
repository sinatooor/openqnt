import { useState, useRef, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button, Input, Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui";
import { Loader2, Zap, Play } from "lucide-react";
import { toast } from "sonner";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from "recharts";

interface McptResult {
    pValue: number;
    permutedPfs: number[];
    realPf: number;
    success: boolean;
    error?: string;
}

interface McptSimulationModalProps {
    isOpen: boolean;
    onClose: () => void;
    symbol: string;
}

export const McptSimulationModal = ({ isOpen, onClose, symbol }: McptSimulationModalProps) => {
    const [isRunning, setIsRunning] = useState(false);
    const [result, setResult] = useState<McptResult | null>(null);
    const [ws, setWs] = useState<WebSocket | null>(null);

    // Chart Data State
    // We use a Map for efficient merging: time -> { time, real: val, perm_0: val, ... }
    const chartDataMapRef = useRef<Map<string, any>>(new Map());
    const [chartData, setChartData] = useState<any[]>([]);
    const [permKeys, setPermKeys] = useState<string[]>([]);

    // Parameters
    const [startDate, setStartDate] = useState("2024-01-01");
    const [endDate, setEndDate] = useState("2024-03-31");
    const [permutations, setPermutations] = useState("50"); // Default lower for better performance initially
    const [timeframe, setTimeframe] = useState("1d");

    // Cleanup WebSocket on unmount
    useEffect(() => {
        return () => {
            if (ws) ws.close();
        };
    }, [ws]);

    const handleRunSimulation = () => {
        if (ws) ws.close();

        setIsRunning(true);
        setResult(null);
        setChartData([]);
        setPermKeys([]);
        chartDataMapRef.current.clear();

        const socket = new WebSocket("ws://localhost:8000/api/mcpt/ws/run");
        setWs(socket);

        socket.onopen = () => {
            socket.send(JSON.stringify({
                symbol,
                startDate,
                endDate,
                timeframe,
                permutations: parseInt(permutations)
            }));
        };

        socket.onmessage = (event) => {
            const msg = JSON.parse(event.data);

            if (msg.type === "error") {
                toast.error("Simulation failed", { description: msg.message });
                setIsRunning(false);
                socket.close();
            } else if (msg.type === "real") {
                // Update Real Curve
                const map = chartDataMapRef.current;
                msg.data.forEach((p: any) => {
                    if (!map.has(p.time)) {
                        map.set(p.time, { time: p.time, timestamp: new Date(p.time).getTime() });
                    }
                    const entry = map.get(p.time);
                    entry.real = p.value;
                });
                updateChart();
            } else if (msg.type === "perm") {
                // Update Permutations
                const map = chartDataMapRef.current;
                const pid = msg.id;

                // Add key if new
                setPermKeys(prev => {
                    if (prev.includes(pid)) return prev;
                    return [...prev, pid];
                });

                msg.data.forEach((p: any) => {
                    if (!map.has(p.time)) {
                        map.set(p.time, { time: p.time, timestamp: new Date(p.time).getTime() });
                    }
                    const entry = map.get(p.time);
                    entry[pid] = p.value;
                });

                // Debounce/throttle updates? simpler to just update
                updateChart();
            } else if (msg.type === "done") {
                setResult({
                    pValue: msg.pValue,
                    realPf: msg.realPf,
                    permutedPfs: msg.permutedPfs,
                    success: true
                });
                setIsRunning(false);
                toast.success("Simulation completed");
                socket.close();
            }
        };

        socket.onerror = (error) => {
            console.error("WebSocket Error:", error);
            toast.error("Connection error");
            setIsRunning(false);
        };
    };

    const updateChart = () => {
        // Sort by timestamp
        const data = Array.from(chartDataMapRef.current.values())
            .sort((a, b) => a.timestamp - b.timestamp);
        setChartData(data);
    };

    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' });
        } catch {
            return dateStr;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open && ws) ws.close();
            onClose();
        }}>
            <DialogContent className="max-w-5xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-purple-500" />
                        PPM Simulation (MCPT)
                    </DialogTitle>
                    <DialogDescription>
                        Real-time Monte Carlo Permutation Test. Red line = Real Strategy, Grey lines = Permutations.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid grid-cols-4 gap-4 py-2">
                    <div className="space-y-1">
                        <Label className="text-xs">Start Date</Label>
                        <Input type="date" className="h-8" value={startDate} onChange={e => setStartDate(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">End Date</Label>
                        <Input type="date" className="h-8" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Permutations</Label>
                        <Input type="number" className="h-8" value={permutations} onChange={e => setPermutations(e.target.value)} min="10" max="200" />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs">Action</Label>
                        <Button onClick={handleRunSimulation} disabled={isRunning} className="w-full h-8">
                            {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
                            {isRunning ? "Running..." : "Run"}
                        </Button>
                    </div>
                </div>

                <div className="flex-1 min-h-0 border rounded-lg bg-black/50 p-4 relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis
                                dataKey="time"
                                tickFormatter={formatDate}
                                stroke="#888"
                                fontSize={10}
                                minTickGap={50}
                            />
                            <YAxis
                                stroke="#888"
                                fontSize={10}
                                label={{ value: 'Cumulative Log Return', angle: -90, position: 'insideLeft', style: { fill: '#888' } }}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#111', borderColor: '#333' }}
                                labelFormatter={formatDate}
                                formatter={(value: number) => [value.toFixed(4), '']}
                            />
                            <Legend />

                            {/* Render Permutation Lines */}
                            {permKeys.map(key => (
                                <Line
                                    key={key}
                                    type="monotone"
                                    dataKey={key}
                                    stroke="#ffffff"
                                    strokeOpacity={0.15}
                                    strokeWidth={1}
                                    dot={false}
                                    isAnimationActive={false}
                                />
                            ))}

                            {/* Render Real Line (Last to be on top) */}
                            <Line
                                type="monotone"
                                dataKey="real"
                                stroke="#ef4444" // Red-500
                                strokeWidth={2}
                                dot={false}
                                name="Real Strategy"
                                isAnimationActive={false}
                            />
                        </LineChart>
                    </ResponsiveContainer>

                    {/* Results Overlay */}
                    {result && (
                        <div className="absolute top-4 left-4 bg-black/80 backdrop-blur border border-border p-3 rounded-lg shadow-xl">
                            <h3 className="text-sm font-bold mb-2">Simulation Results</h3>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                                <span className="text-muted-foreground">P-Value:</span>
                                <span className={result.pValue < 0.05 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                                    {result.pValue.toFixed(4)}
                                </span>

                                <span className="text-muted-foreground">Real Profit Factor:</span>
                                <span>{result.realPf.toFixed(2)}</span>

                                <span className="text-muted-foreground">Significance:</span>
                                <span className={result.pValue < 0.05 ? "text-green-400" : "text-yellow-400"}>
                                    {result.pValue < 0.05 ? "Significant" : "Not Significant"}
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
