
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Clock, Activity, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { fetchExecution, fetchTrades } from "@/services/trades";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ExecutionDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const executionId = parseInt(id || "0");

  const { data: execution, isLoading: loadingExecution } = useQuery({
    queryKey: ['execution', executionId],
    queryFn: () => fetchExecution(executionId),
    enabled: !!executionId,
  });

  const { data: trades = [], isLoading: loadingTrades } = useQuery({
    queryKey: ['trades', 'execution', executionId],
    queryFn: () => fetchTrades({ execution_id: executionId }),
    enabled: !!executionId,
  });

  if (!executionId) return <div>Invalid ID</div>;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/journal")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Journal
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Execution Details</h1>
        </div>

        {loadingExecution ? (
          <div>Loading execution details...</div>
        ) : execution ? (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Strategy Info</span>
                  <Badge variant={execution.status === 'RUNNING' ? 'default' : 'secondary'}>
                    {execution.status}
                  </Badge>
                </CardTitle>
                <CardDescription>Configuration and Status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-muted-foreground flex items-center"><Activity className="w-4 h-4 mr-2" /> Name</span>
                  <span className="font-semibold">{execution.strategy_name}</span>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-muted-foreground flex items-center"><BarChart2 className="w-4 h-4 mr-2" /> Symbol</span>
                  <span className="font-mono">{execution.symbol}</span>
                </div>
                <div className="flex justify-between items-center border-b pb-2">
                  <span className="text-muted-foreground flex items-center"><Clock className="w-4 h-4 mr-2" /> Start Time</span>
                  <span>{new Date(execution.start_time).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center pb-2">
                  <span className="text-muted-foreground">End Time</span>
                  <span>{execution.end_time ? new Date(execution.end_time).toLocaleString() : 'Running...'}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Summary</CardTitle>
                <CardDescription>Session Statistics</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-muted/20 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Total Trades</p>
                    <p className="text-2xl font-bold">{trades.length}</p>
                  </div>
                  <div className="text-center p-4 bg-muted/20 rounded-lg">
                    <p className="text-sm text-muted-foreground mb-1">Net PnL</p>
                    <p className={`text-2xl font-bold ${trades.reduce((acc, t) => acc + (t.pnl || 0), 0) >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                      ${trades.reduce((acc, t) => acc + (t.pnl || 0), 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div>Execution not found.</div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Trade Log</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Size</TableHead>
                  <TableHead className="text-right">PnL</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.map((trade) => (
                  <TableRow key={trade.id}>
                    <TableCell className="font-mono text-xs">{new Date(trade.entry_time).toLocaleTimeString()}</TableCell>
                    <TableCell className={trade.direction === 'BUY' ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>{trade.direction}</TableCell>
                    <TableCell className="text-right font-mono">{trade.entry_price.toFixed(5)}</TableCell>
                    <TableCell className="text-right">{trade.size}</TableCell>
                    <TableCell className={`text-right font-bold ${trade.pnl && trade.pnl > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {trade.pnl?.toFixed(2) || '-'}
                    </TableCell>
                    <TableCell><Badge variant="outline">{trade.status}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ExecutionDetails;