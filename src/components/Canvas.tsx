import { useState, useCallback, useRef, useEffect } from "react";
import { useDrop, useDragLayer } from "react-dnd";
import { BlockItem, BlockData } from "./BlockItem";

export interface PlacedBlock extends BlockData {
  uniqueId: string;
  x: number;
  y: number;
  connectedTo?: string; // ID of the block this one is connected below
}

const GRID_SIZE = 20;
const SNAP_DISTANCE = 40; // Distance for blocks to snap together
const BLOCK_HEIGHT = 50; // Approximate height of a block

export const Canvas = () => {
  const [blocks, setBlocks] = useState<PlacedBlock[]>([]);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [snapTarget, setSnapTarget] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Use drag layer to track cursor position for snap preview
  const { isDragging, currentOffset } = useDragLayer((monitor) => ({
    isDragging: monitor.isDragging(),
    currentOffset: monitor.getClientOffset(),
  }));

  const findNearbyBlock = useCallback((x: number, y: number, currentBlockId: string) => {
    for (const block of blocks) {
      if (block.uniqueId === currentBlockId) continue;
      
      // Check if this block is directly above (within snap distance)
      const isHorizontallyAligned = Math.abs(block.x - x) < SNAP_DISTANCE;
      const isVerticallyNear = Math.abs((block.y + BLOCK_HEIGHT) - y) < SNAP_DISTANCE;
      
      if (isHorizontallyAligned && isVerticallyNear) {
        return block;
      }
    }
    return null;
  }, [blocks]);

  // Update snap target when dragging
  const updateSnapTarget = useCallback(() => {
    if (!isDragging || !currentOffset || !canvasRef.current) {
      setSnapTarget(null);
      return;
    }

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const x = Math.round((currentOffset.x - canvasRect.left) / GRID_SIZE) * GRID_SIZE;
    const y = Math.round((currentOffset.y - canvasRect.top) / GRID_SIZE) * GRID_SIZE;

    const nearbyBlock = findNearbyBlock(x, y, draggingBlockId || "");
    setSnapTarget(nearbyBlock?.uniqueId || null);
  }, [isDragging, currentOffset, findNearbyBlock, draggingBlockId]);

  // Update snap target whenever drag position changes
  useEffect(() => {
    updateSnapTarget();
  }, [updateSnapTarget]);

  const [{ isOver }, drop] = useDrop(() => ({
    accept: "block",
    drop: (item: BlockData, monitor) => {
      const offset = monitor.getClientOffset();
      if (offset && canvasRef.current) {
        const canvasRect = canvasRef.current.getBoundingClientRect();
        
        // Check if dropped outside canvas (for deletion)
        if (
          offset.x < canvasRect.left ||
          offset.x > canvasRect.right ||
          offset.y < canvasRect.top ||
          offset.y > canvasRect.bottom
        ) {
          // Delete the block if it was being dragged from canvas
          if (draggingBlockId) {
            setBlocks((prev) => prev.filter((b) => b.uniqueId !== draggingBlockId));
            setDraggingBlockId(null);
          }
          setSnapTarget(null);
          return;
        }

        // Snap to grid
        let x = Math.round((offset.x - canvasRect.left) / GRID_SIZE) * GRID_SIZE;
        let y = Math.round((offset.y - canvasRect.top) / GRID_SIZE) * GRID_SIZE;
        
        const newBlockId = `${item.id}-${Date.now()}`;
        
        // Check for nearby blocks to snap to
        const nearbyBlock = findNearbyBlock(x, y, newBlockId);
        let connectedTo: string | undefined = undefined;
        
        if (nearbyBlock) {
          // Snap below the nearby block
          x = nearbyBlock.x;
          y = nearbyBlock.y + BLOCK_HEIGHT;
          connectedTo = nearbyBlock.uniqueId;
        }

        if (draggingBlockId) {
          // Moving existing block
          setBlocks((prev) =>
            prev.map((b) =>
              b.uniqueId === draggingBlockId
                ? { ...b, x, y, connectedTo }
                : b
            )
          );
          setDraggingBlockId(null);
        } else {
          // Adding new block
          setBlocks((prev) => [
            ...prev,
            {
              ...item,
              uniqueId: newBlockId,
              x,
              y,
              connectedTo,
            },
          ]);
        }
        setSnapTarget(null);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }), [blocks, draggingBlockId, findNearbyBlock]);

  const handleBlockDrag = useCallback((blockId: string) => {
    setDraggingBlockId(blockId);
  }, []);

  const getBlockChain = useCallback((blockId: string): PlacedBlock[] => {
    const block = blocks.find((b) => b.uniqueId === blockId);
    if (!block) return [];
    
    const chain = [block];
    const childBlocks = blocks.filter((b) => b.connectedTo === blockId);
    childBlocks.forEach((child) => {
      chain.push(...getBlockChain(child.uniqueId));
    });
    
    return chain;
  }, [blocks]);

  return (
    <div
      ref={(node) => {
        canvasRef.current = node;
        drop(node);
      }}
      className="flex-1 relative overflow-auto"
      style={{
        backgroundImage: `
          linear-gradient(to right, hsl(var(--grid-color)) 1px, transparent 1px),
          linear-gradient(to bottom, hsl(var(--grid-color)) 1px, transparent 1px)
        `,
        backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
      }}
    >
      {isOver && (
        <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
      )}
      
      {blocks.map((block) => {
        // Only render blocks that aren't connected (top-level blocks)
        if (block.connectedTo) return null;
        
        const chain = getBlockChain(block.uniqueId);
        const isSnapTarget = snapTarget === block.uniqueId;
        
        return (
          <div
            key={block.uniqueId}
            className="absolute"
            style={{
              left: block.x,
              top: block.y,
            }}
          >
            {chain.map((chainBlock, index) => (
              <div
                key={chainBlock.uniqueId}
                className="relative"
                style={{
                  marginTop: index > 0 ? "2px" : "0",
                }}
              >
                {/* Snap indicator - show at the bottom of this block if it's the snap target */}
                {chainBlock.uniqueId === snapTarget && (
                  <div className="absolute -bottom-1 left-0 right-0 h-2 bg-primary/60 rounded-full animate-pulse z-10" />
                )}
                
                <BlockItem
                  block={chainBlock}
                  onDrag={() => handleBlockDrag(chainBlock.uniqueId)}
                />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};
