import { useState, useEffect, ReactNode, useRef, useCallback } from "react";
import {
    DndContext,
    useSensor,
    useSensors,
    PointerSensor,
    DragEndEvent,
    DragMoveEvent,
    DragStartEvent,
} from "@dnd-kit/core";
import { useDraggable } from "@dnd-kit/core";
import { Button } from "./ui/button";
import { X, Maximize2, Minimize2, GripHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

// Global z-index manager for modals
let globalZIndex = 9000;
const getNextZIndex = () => ++globalZIndex;

// Corner zones for snapping
type CornerZone = "top-left" | "top-right" | "bottom-left" | "bottom-right" | null;
type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw" | null;

interface DraggableModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
    defaultWidth?: number;
    defaultHeight?: number;
    minWidth?: number;
    minHeight?: number;
    headerActions?: ReactNode;
    className?: string;
    onFocus?: () => void;
    zIndex?: number;
}

// Get corner zone from mouse position
const getCornerZone = (x: number, y: number): CornerZone => {
    const threshold = 100; // pixels from edge to trigger corner snap
    const isTop = y < threshold;
    const isBottom = y > window.innerHeight - threshold;
    const isLeft = x < threshold;
    const isRight = x > window.innerWidth - threshold;

    if (isTop && isLeft) return "top-left";
    if (isTop && isRight) return "top-right";
    if (isBottom && isLeft) return "bottom-left";
    if (isBottom && isRight) return "bottom-right";
    return null;
};

// Get corner position styles
const getCornerStyles = (corner: CornerZone): React.CSSProperties => {
    const halfWidth = "calc(50vw - 8px)";
    const halfHeight = "calc(50vh - 8px)";

    switch (corner) {
        case "top-left":
            return { top: 4, left: 4, width: halfWidth, height: halfHeight, right: "auto", bottom: "auto" };
        case "top-right":
            return { top: 4, right: 4, width: halfWidth, height: halfHeight, left: "auto", bottom: "auto" };
        case "bottom-left":
            return { bottom: 4, left: 4, width: halfWidth, height: halfHeight, top: "auto", right: "auto" };
        case "bottom-right":
            return { bottom: 4, right: 4, width: halfWidth, height: halfHeight, top: "auto", left: "auto" };
        default:
            return {};
    }
};

// Draggable header component
interface DraggableHeaderProps {
    title: string;
    headerActions?: ReactNode;
    isMaximized: boolean;
    cornerSnap: CornerZone;
    onMaximize: () => void;
    onClose: () => void;
}

const DraggableHeader = ({
    title,
    headerActions,
    isMaximized,
    cornerSnap,
    onMaximize,
    onClose,
}: DraggableHeaderProps) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: "modal-header",
    });

    return (
        <div
            ref={setNodeRef}
            {...listeners}
            {...attributes}
            className={cn(
                "flex items-center justify-between p-2.5 border-b border-border bg-secondary/50 select-none",
                isDragging ? "cursor-grabbing" : "cursor-grab"
            )}
        >
            <div className="flex items-center gap-1.5">
                <GripHorizontal className="w-3.5 h-3.5 text-muted-foreground" />
                <h3 className="font-semibold text-xs">{title}</h3>
                {headerActions}
            </div>
            <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={onMaximize}
                    title={isMaximized || cornerSnap ? "Restore" : "Maximize"}
                >
                    {isMaximized || cornerSnap ? (
                        <Minimize2 className="w-3.5 h-3.5" />
                    ) : (
                        <Maximize2 className="w-3.5 h-3.5" />
                    )}
                </Button>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
                    onClick={onClose}
                >
                    <X className="w-3.5 h-3.5" />
                </Button>
            </div>
        </div>
    );
};

export const DraggableModal = ({
    isOpen,
    onClose,
    title,
    children,
    defaultWidth = 800,
    defaultHeight = 600,
    minWidth = 400,
    minHeight = 300,
    headerActions,
    className,
    onFocus,
    zIndex = 9000,
}: DraggableModalProps) => {
    // Position state - base position (updated on drag end)
    const [basePosition, setBasePosition] = useState({ x: 100, y: 100 });
    // Delta during drag (real-time offset)
    const [dragDelta, setDragDelta] = useState({ x: 0, y: 0 });
    const [size, setSize] = useState({ width: defaultWidth, height: defaultHeight });
    const [isMaximized, setIsMaximized] = useState(false);
    const [cornerSnap, setCornerSnap] = useState<CornerZone>(null);
    const [hoverCorner, setHoverCorner] = useState<CornerZone>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Dynamic z-index for active modal management
    const [currentZIndex, setCurrentZIndex] = useState(zIndex);

    // Track pre-snap position for smooth unsnap
    const preSnapPositionRef = useRef({ x: 100, y: 100 });
    const dragStartMouseRef = useRef({ x: 0, y: 0 });

    // Resize state
    const [isResizing, setIsResizing] = useState(false);
    const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
    const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 });

    // Responsive pointer sensor - minimum distance of 1px for instant response
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 1,
            },
        })
    );

    // Center modal when it opens
    useEffect(() => {
        if (isOpen) {
            // Calculate centered position
            const centerX = Math.max(50, (window.innerWidth - defaultWidth) / 2);
            const centerY = Math.max(50, (window.innerHeight - defaultHeight) / 2);

            setBasePosition({ x: centerX, y: centerY });
            preSnapPositionRef.current = { x: centerX, y: centerY };
            setDragDelta({ x: 0, y: 0 });
            setSize({ width: defaultWidth, height: defaultHeight });
            setCornerSnap(null);
            setIsMaximized(false);
            setCurrentZIndex(getNextZIndex());
        }
    }, [isOpen, defaultWidth, defaultHeight]);

    // Bring modal to front when clicked
    const bringToFront = useCallback(() => {
        setCurrentZIndex(getNextZIndex());
        onFocus?.();
    }, [onFocus]);

    // Handle drag start
    const handleDragStart = (event: DragStartEvent) => {
        setIsDragging(true);
        setDragDelta({ x: 0, y: 0 });
        bringToFront();

        // Store mouse position at drag start for smooth unsnap
        const pointerEvent = event.activatorEvent as PointerEvent;
        dragStartMouseRef.current = { x: pointerEvent.clientX, y: pointerEvent.clientY };

        if (isMaximized || cornerSnap) {
            // Calculate where the modal should appear based on mouse position
            // Place the modal so the mouse is at the center-top of the header
            const newX = pointerEvent.clientX - size.width / 2;
            const newY = pointerEvent.clientY - 20; // 20px below mouse for header grab

            setBasePosition({ x: Math.max(0, newX), y: Math.max(0, newY) });
            preSnapPositionRef.current = { x: Math.max(0, newX), y: Math.max(0, newY) };

            // Exit maximized/corner snap mode on drag
            setIsMaximized(false);
            setCornerSnap(null);
        } else {
            // Save current position in case we snap later
            preSnapPositionRef.current = { ...basePosition };
        }
    };

    // Handle drag move - UPDATE POSITION IN REAL-TIME
    const handleDragMove = (event: DragMoveEvent) => {
        const { delta } = event;

        // Update delta in real-time for smooth following
        setDragDelta({ x: delta.x, y: delta.y });

        // Check for corner hover
        const activeRect = event.active.rect.current.translated;
        if (activeRect) {
            const mouseX = activeRect.left + activeRect.width / 2;
            const mouseY = activeRect.top;
            setHoverCorner(getCornerZone(mouseX, mouseY));
        }
    };

    // Handle drag end
    const handleDragEnd = (event: DragEndEvent) => {
        const { delta } = event;

        setIsDragging(false);
        setDragDelta({ x: 0, y: 0 });

        // Check for corner snap
        const activeRect = event.active.rect.current.translated;
        if (activeRect) {
            const mouseX = activeRect.left + activeRect.width / 2;
            const mouseY = activeRect.top;
            const corner = getCornerZone(mouseX, mouseY);

            if (corner) {
                setCornerSnap(corner);
                setHoverCorner(null);
                return;
            }
        }

        // Commit final position
        setBasePosition((prev) => ({
            x: prev.x + delta.x,
            y: prev.y + delta.y,
        }));

        setHoverCorner(null);
    };

    // Handle resize start
    const handleResizeStart = (e: React.MouseEvent, handle: ResizeHandle) => {
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        setResizeHandle(handle);
        resizeStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            width: size.width,
            height: size.height,
            posX: basePosition.x,
            posY: basePosition.y,
        };
    };

    // Handle resize move
    useEffect(() => {
        if (!isResizing || !resizeHandle) return;

        const handleMouseMove = (e: MouseEvent) => {
            const deltaX = e.clientX - resizeStartRef.current.x;
            const deltaY = e.clientY - resizeStartRef.current.y;

            let newWidth = resizeStartRef.current.width;
            let newHeight = resizeStartRef.current.height;
            let newX = resizeStartRef.current.posX;
            let newY = resizeStartRef.current.posY;

            // Handle horizontal resize
            if (resizeHandle.includes("e")) {
                newWidth = Math.max(minWidth, resizeStartRef.current.width + deltaX);
            } else if (resizeHandle.includes("w")) {
                const widthChange = -deltaX;
                newWidth = Math.max(minWidth, resizeStartRef.current.width + widthChange);
                if (newWidth > minWidth) {
                    newX = resizeStartRef.current.posX + deltaX;
                }
            }

            // Handle vertical resize
            if (resizeHandle.includes("s")) {
                newHeight = Math.max(minHeight, resizeStartRef.current.height + deltaY);
            } else if (resizeHandle.includes("n")) {
                const heightChange = -deltaY;
                newHeight = Math.max(minHeight, resizeStartRef.current.height + heightChange);
                if (newHeight > minHeight) {
                    newY = resizeStartRef.current.posY + deltaY;
                }
            }

            setSize({ width: newWidth, height: newHeight });
            setBasePosition({ x: newX, y: newY });
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            setResizeHandle(null);
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);

        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isResizing, resizeHandle, minWidth, minHeight]);

    // Handle maximize toggle
    const handleMaximize = () => {
        if (cornerSnap) {
            setCornerSnap(null);
            setIsMaximized(false);
        } else if (isMaximized) {
            setIsMaximized(false);
        } else {
            setIsMaximized(true);
            setCornerSnap(null);
        }
    };

    // Handle click to bring to front
    const handleModalClick = () => {
        bringToFront();
    };

    if (!isOpen) return null;

    // Current position = base + delta during drag
    const currentPosition = {
        x: basePosition.x + dragDelta.x,
        y: basePosition.y + dragDelta.y,
    };

    // Calculate modal styles
    const getModalStyles = (): React.CSSProperties => {
        if (isMaximized) {
            return {
                position: "fixed",
                top: 4,
                left: 4,
                right: 4,
                bottom: 4,
                width: "calc(100vw - 8px)",
                height: "calc(100vh - 8px)",
                zIndex: currentZIndex,
            };
        }

        if (cornerSnap) {
            return {
                position: "fixed",
                ...getCornerStyles(cornerSnap),
                zIndex: currentZIndex,
            };
        }

        return {
            position: "fixed",
            left: currentPosition.x,
            top: currentPosition.y,
            width: size.width,
            height: size.height,
            zIndex: currentZIndex,
        };
    };

    return (
        <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
        >
            {/* Corner drop zone indicators (shown while dragging) */}
            {isDragging && (
                <>
                    <div
                        className={cn(
                            "fixed top-0 left-0 w-24 h-24 border-4 border-dashed rounded-br-3xl transition-all duration-100 pointer-events-none",
                            hoverCorner === "top-left"
                                ? "border-primary bg-primary/20 scale-110"
                                : "border-muted-foreground/30 bg-muted/10"
                        )}
                        style={{ zIndex: currentZIndex - 1 }}
                    />
                    <div
                        className={cn(
                            "fixed top-0 right-0 w-24 h-24 border-4 border-dashed rounded-bl-3xl transition-all duration-100 pointer-events-none",
                            hoverCorner === "top-right"
                                ? "border-primary bg-primary/20 scale-110"
                                : "border-muted-foreground/30 bg-muted/10"
                        )}
                        style={{ zIndex: currentZIndex - 1 }}
                    />
                    <div
                        className={cn(
                            "fixed bottom-0 left-0 w-24 h-24 border-4 border-dashed rounded-tr-3xl transition-all duration-100 pointer-events-none",
                            hoverCorner === "bottom-left"
                                ? "border-primary bg-primary/20 scale-110"
                                : "border-muted-foreground/30 bg-muted/10"
                        )}
                        style={{ zIndex: currentZIndex - 1 }}
                    />
                    <div
                        className={cn(
                            "fixed bottom-0 right-0 w-24 h-24 border-4 border-dashed rounded-tl-3xl transition-all duration-100 pointer-events-none",
                            hoverCorner === "bottom-right"
                                ? "border-primary bg-primary/20 scale-110"
                                : "border-muted-foreground/30 bg-muted/10"
                        )}
                        style={{ zIndex: currentZIndex - 1 }}
                    />
                </>
            )}

            {/* Modal */}
            <div
                className={cn(
                    "flex flex-col shadow-2xl rounded-lg overflow-hidden border border-border bg-card",
                    className
                )}
                style={getModalStyles()}
                onClick={handleModalClick}
            >
                {/* Draggable Header */}
                <DraggableHeader
                    title={title}
                    headerActions={headerActions}
                    isMaximized={isMaximized}
                    cornerSnap={cornerSnap}
                    onMaximize={handleMaximize}
                    onClose={onClose}
                />

                {/* Content */}
                <div className="flex-1 overflow-auto">{children}</div>

                {/* Resize Handles - only show when not maximized/snapped */}
                {!isMaximized && !cornerSnap && (
                    <>
                        {/* Corner handles */}
                        <div className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize" onMouseDown={(e) => handleResizeStart(e, "nw")} />
                        <div className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize" onMouseDown={(e) => handleResizeStart(e, "ne")} />
                        <div className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize" onMouseDown={(e) => handleResizeStart(e, "sw")} />
                        <div className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize" onMouseDown={(e) => handleResizeStart(e, "se")} />

                        {/* Edge handles */}
                        <div className="absolute top-0 left-3 right-3 h-1 cursor-n-resize" onMouseDown={(e) => handleResizeStart(e, "n")} />
                        <div className="absolute bottom-0 left-3 right-3 h-1 cursor-s-resize" onMouseDown={(e) => handleResizeStart(e, "s")} />
                        <div className="absolute left-0 top-3 bottom-3 w-1 cursor-w-resize" onMouseDown={(e) => handleResizeStart(e, "w")} />
                        <div className="absolute right-0 top-3 bottom-3 w-1 cursor-e-resize" onMouseDown={(e) => handleResizeStart(e, "e")} />
                    </>
                )}
            </div>
        </DndContext>
    );
};

export default DraggableModal;
