import { useState } from "react";
import { DraggableModal } from "./DraggableModal";
import { Button } from "./ui/button";
import { FileText } from "lucide-react";

interface BacktestVisualizationModalProps {
    isOpen: boolean;
    onClose: () => void;
    htmlContent: string | null;
    rawStats?: string | null;
    title?: string;
}

export const BacktestVisualizationModal = ({
    isOpen,
    onClose,
    htmlContent,
    rawStats,
    title = "Backtest Visualization"
}: BacktestVisualizationModalProps) => {
    const [showStats, setShowStats] = useState(false);

    if (!isOpen || (!htmlContent && !rawStats)) return null;

    const headerActions = rawStats ? (
        <Button
            variant={showStats ? "secondary" : "ghost"}
            size="sm"
            className="h-6 text-xs ml-2"
            onClick={() => setShowStats(!showStats)}
        >
            <FileText className="w-3 h-3 mr-1" />
            {showStats ? "Hide Stats" : "Show Stats"}
        </Button>
    ) : null;

    return (
        <DraggableModal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            defaultWidth={1000}
            defaultHeight={700}
            headerActions={headerActions}

        >
            <div className="w-full h-full relative bg-white">
                {showStats && rawStats ? (
                    <div className="absolute inset-0 z-10 bg-card p-4 overflow-auto font-mono text-xs whitespace-pre">
                        {rawStats}
                    </div>
                ) : htmlContent ? (
                    <iframe
                        title="Backtest Plot"
                        srcDoc={htmlContent}
                        className="w-full h-full border-none"
                        sandbox="allow-scripts allow-popups allow-forms"
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        No visualization available
                    </div>
                )}
            </div>
        </DraggableModal>
    );
};
