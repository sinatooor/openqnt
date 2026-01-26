
import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Clock, RotateCcw, Box, ArrowRight } from "lucide-react";
import { API_BASE_URL } from "@/services/api";
import { toast } from "sonner";
import { useUserProfile } from "@/hooks/useUserProfile";
import { formatDistanceToNow } from "date-fns";

interface StrategyVersion {
    id: string;
    name: string;
    saved_at: string;
    block_count: number;
    xml: string;
}

interface StrategyHistoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    strategyId: string;
    onRestore: (xml: string, name: string) => void;
}

export const StrategyHistoryModal = ({
    isOpen,
    onClose,
    strategyId,
    onRestore
}: StrategyHistoryModalProps) => {
    const { user } = useUserProfile();
    const [history, setHistory] = useState<StrategyVersion[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && strategyId && user) {
            fetchHistory();
        }
    }, [isOpen, strategyId, user]);

    const fetchHistory = async () => {
        if (!user || !strategyId) return;
        setIsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/api/strategies/${strategyId}/history?user_id=${user.id}`);
            if (res.ok) {
                const data = await res.json();
                setHistory(data);
            } else {
                toast.error("Failed to load history");
            }
        } catch (e) {
            console.error(e);
            toast.error("Error loading history");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRestore = async (version: StrategyVersion) => {
        if (!user) return;

        try {
            // Call restore endpoint to create a new version on backend
            // But for frontend UX, we just want to load it into the workspace
            // If we want to strictly follow "Restore = Save New Version", we can call backend.
            // But typically "Restore" in this context might just mean "Load this version to edit".
            // The plan said: "Restore button... verify workspace reverts to V1 state".

            // Let's just load it into workspace. The user can then Save if they want (creationg new version).
            // Calling the backend restore endpoint is cleaner for audit trails though.

            // Option 1: Just load XML (Fast, simple)
            onRestore(version.xml, version.name);
            onClose();
            toast.success(`Restored version from ${new Date(version.saved_at).toLocaleTimeString()}`);

            // Option 2: Backend track (Better for strict versioning)
            /*
            const res = await fetch(`${API_BASE_URL}/api/strategies/${strategyId}/restore/${version.id}?user_id=${user.id}`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                // We'd expect new ID back, but for now we just load the XML of the restored version
                onRestore(version.xml, version.name);
                onClose();
            }
            */

        } catch (e) {
            toast.error("Failed to restore");
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Version History</DialogTitle>
                    <DialogDescription>
                        View and restore previous versions of this strategy.
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="h-[400px] pr-4">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-20 text-muted-foreground">
                            Loading history...
                        </div>
                    ) : history.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                            No history found.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {history.map((version, i) => (
                                <div key={version.id} className="flex flex-col gap-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="font-mono text-xs">
                                                v{history.length - i}
                                            </Badge>
                                            <span className="text-sm font-medium">
                                                {new Date(version.saved_at).toLocaleDateString()}
                                                <span className="text-muted-foreground ml-1">
                                                    {new Date(version.saved_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </span>
                                        </div>
                                        {i === 0 && <Badge className="bg-green-600">Current</Badge>}
                                    </div>

                                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                                        <div className="flex items-center gap-4">
                                            <span className="flex items-center gap-1">
                                                <Box className="w-3 h-3" />
                                                {version.block_count} Blocks
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {tryFormatDistance(version.saved_at)} ago
                                            </span>
                                        </div>

                                        <Button size="sm" variant="secondary" onClick={() => handleRestore(version)} className="h-7">
                                            <RotateCcw className="w-3 h-3 mr-1" />
                                            Restore
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
};

// Helper to avoid crash if date invalid
function tryFormatDistance(dateStr: string) {
    try {
        return formatDistanceToNow(new Date(dateStr));
    } catch {
        return "Unknown time";
    }
}
