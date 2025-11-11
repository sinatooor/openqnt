import { useState, useCallback, useRef } from "react";
import { useDrop } from "react-dnd";
import { BlockItem, BlockData } from "./BlockItem";

export interface PlacedBlock extends BlockData {
  uniqueId: string;
  x: number;
  y: number;
  connectedTo?: string; // ID of the block this one is connected below
}

const GRID_SIZE = 20;
const SNAP_DISTANCE = 40; // Distance for blocks to snap together

export const Canvas = () => {
  const [blocks, setBlocks] = useState<PlacedBlock[]>([]);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const findNearbyBlock = (x: number, y: number, currentBlockId: string) => {
    for (const block of blocks) {
      if (block.uniqueId === currentBlockId) continue;
      
      // Check if this block is directly above (within snap distance)
      const isHorizontallyAligned = Math.abs(block.x - x) < SNAP_DISTANCE;
      const isVerticallyNear = Math.abs((block.y + 50) - y) < SNAP_DISTANCE; // 50px is approximate block height
      
      if (isHorizontallyAligned && isVerticallyNear) {
        return block;
      }
    }
    return null;
  };

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
          y = nearbyBlock.y + 50; // Stack vertically
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
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }), [blocks, draggingBlockId]);

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
        // Connected blocks will be rendered as part of their parent chain
        if (block.connectedTo) return null;
        
        const chain = getBlockChain(block.uniqueId);
        
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
                style={{
                  marginTop: index > 0 ? "2px" : "0",
                }}
              >
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
