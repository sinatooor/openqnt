
import { useEffect, useState } from "react";
import Draggable from "react-draggable";
import { Card, CardContent, CardHeader } from "./ui/card";
import { Button } from "./ui/button";
import { X, Maximize2, Minimize2, GripHorizontal, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

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
    const [isMaximized, setIsMaximized] = useState(false);
    const [showStats, setShowStats] = useState(false);
    const [position, setPosition] = useState({ x: 50, y: 50 });

    if (!isOpen || (!htmlContent && !rawStats)) return null;

    return (
        <>
            <div className="fixed inset-0 z-40 bg-background/20 backdrop-blur-sm pointer-events-none" />

            <Draggable
                handle=".drag-handle"
                bounds="body"
                position={isMaximized ? { x: 0, y: 0 } : position}
                onStop={(e, data) => !isMaximized && setPosition({ x: data.x, y: data.y })}
                disabled={isMaximized}
            >
                <div
                    className={cn(
                        "fixed z-50 pointer-events-auto transition-all duration-300 flex flex-col shadow-2xl rounded-lg overflow-hidden border border-border bg-card",
                        isMaximized
                            ? "inset-2 w-[calc(100%-1rem)] h-[calc(100%-1rem)]"
                            : "w-[90vw] h-[80vh] md:w-[1000px] md:h-[700px]"
                    )}
                    style={!isMaximized ? { left: 0, top: 0 } : undefined}
                >
                    <div className="drag-handle flex items-center justify-between p-3 border-b border-border bg-secondary/50 cursor-move">
                        <div className="flex items-center gap-2">
                            <GripHorizontal className="w-4 h-4 text-muted-foreground" />
                            <h3 className="font-semibold text-sm flex items-center gap-2">
                                {title}
                                {rawStats && (
                                    <Button
                                        variant={showStats ? "secondary" : "ghost"}
                                        size="sm"
                                        className="h-6 text-xs ml-2"
                                        onClick={() => setShowStats(!showStats)}
                                    >
                                        <FileText className="w-3 h-3 mr-1" />
                                        {showStats ? "Hide Stats" : "Show Stats"}
                                    </Button>
                                )}
                            </h3>
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setIsMaximized(!isMaximized)}
                            >
                                {isMaximized ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive"
                                onClick={onClose}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-hidden relative bg-white">
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
                </div>
            </Draggable>
        </>
    );
};
