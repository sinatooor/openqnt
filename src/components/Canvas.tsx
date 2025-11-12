import { useState, useCallback, useRef, useEffect } from "react";
import { useDrop, useDragLayer } from "react-dnd";
import { BlockItem, BlockData } from "./BlockItem";

export interface PlacedBlock extends BlockData {
  uniqueId: string;
  x: number;
  y: number;
  connectedBelow?: string; // ID of block connected below this one
  parentBlock?: string; // ID of parent block if nested or in slot
  parentSlot?: string; // Which slot/nesting area this block is in
  inputBlocks?: Record<string, string>; // Map of slot ID to block ID
  nestedBlocks?: string[]; // IDs of blocks nested inside (for control blocks)
}

const GRID_SIZE = 20;
const SNAP_DISTANCE = 40;
const SLOT_SNAP_DISTANCE = 30;

export const Canvas = () => {
  const [blocks, setBlocks] = useState<PlacedBlock[]>([]);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [snapTarget, setSnapTarget] = useState<{ blockId: string; type: 'below' | 'slot' | 'nested'; slotId?: string } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const { isDragging, currentOffset, item } = useDragLayer((monitor) => ({
    isDragging: monitor.isDragging(),
    currentOffset: monitor.getClientOffset(),
    item: monitor.getItem() as BlockData | null,
  }));

  const findSnapTarget = useCallback((x: number, y: number, draggedBlock: BlockData | null, currentBlockId: string) => {
    if (!draggedBlock) return null;

    const isValueBlock = draggedBlock.shape === "pill";
    
    for (const block of blocks) {
      if (block.uniqueId === currentBlockId) continue;
      if (block.parentBlock) continue; // Skip blocks that are already nested/slotted

      // For value blocks (pills), check input slots
      if (isValueBlock && block.inputs) {
        for (const input of block.inputs) {
          if (!input.acceptsValue) continue;
          
          // Approximate slot position (this is simplified)
          const slotX = block.x + 100; // Rough estimate
          const slotY = block.y + 10;
          
          if (Math.abs(slotX - x) < SLOT_SNAP_DISTANCE && Math.abs(slotY - y) < SLOT_SNAP_DISTANCE) {
            return { blockId: block.uniqueId, type: 'slot' as const, slotId: input.id };
          }
        }
      }

      // For stack blocks, check nesting areas
      if (!isValueBlock && block.acceptsNesting) {
        const nestX = block.x + 20;
        const nestY = block.y + 60;
        
        if (Math.abs(nestX - x) < SNAP_DISTANCE && Math.abs(nestY - y) < SNAP_DISTANCE) {
          return { blockId: block.uniqueId, type: 'nested' as const };
        }
      }

      // Check for stacking below (only for non-value blocks)
      if (!isValueBlock) {
        const isHorizontallyAligned = Math.abs(block.x - x) < SNAP_DISTANCE;
        const blockHeight = block.acceptsNesting ? 120 : 50;
        const isVerticallyNear = Math.abs((block.y + blockHeight) - y) < SNAP_DISTANCE;
        
        if (isHorizontallyAligned && isVerticallyNear) {
          return { blockId: block.uniqueId, type: 'below' as const };
        }
      }
    }
    return null;
  }, [blocks]);

  useEffect(() => {
    if (!isDragging || !currentOffset || !canvasRef.current) {
      setSnapTarget(null);
      return;
    }

    const canvasRect = canvasRef.current.getBoundingClientRect();
    const x = currentOffset.x - canvasRect.left;
    const y = currentOffset.y - canvasRect.top;

    const target = findSnapTarget(x, y, item, draggingBlockId || "");
    setSnapTarget(target);
  }, [isDragging, currentOffset, findSnapTarget, draggingBlockId, item]);

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
          if (draggingBlockId) {
            setBlocks((prev) => prev.filter((b) => b.uniqueId !== draggingBlockId));
            setDraggingBlockId(null);
          }
          setSnapTarget(null);
          return;
        }

        let x = offset.x - canvasRect.left;
        let y = offset.y - canvasRect.top;
        
        const newBlockId = draggingBlockId || `${item.id}-${Date.now()}`;
        
        const target = findSnapTarget(x, y, item, newBlockId);
        
        if (target) {
          // Handle snapping
          const targetBlock = blocks.find(b => b.uniqueId === target.blockId);
          if (!targetBlock) return;

          if (target.type === 'slot' && target.slotId) {
            // Insert into input slot
            x = targetBlock.x + 100; // Simplified positioning
            y = targetBlock.y + 10;
            
            setBlocks((prev) => {
              const updated = prev.map((b) => {
                if (b.uniqueId === target.blockId) {
                  return {
                    ...b,
                    inputBlocks: { ...b.inputBlocks, [target.slotId!]: newBlockId }
                  };
                }
                if (b.uniqueId === newBlockId) {
                  return { ...b, x, y, parentBlock: target.blockId, parentSlot: target.slotId };
                }
                return b;
              });

              if (!draggingBlockId) {
                updated.push({
                  ...item,
                  uniqueId: newBlockId,
                  x, y,
                  parentBlock: target.blockId,
                  parentSlot: target.slotId
                });
              }

              return updated;
            });
          } else if (target.type === 'nested') {
            // Nest inside control block
            x = targetBlock.x + 20;
            y = targetBlock.y + 60;
            
            setBlocks((prev) => {
              const updated = prev.map((b) => {
                if (b.uniqueId === target.blockId) {
                  const nestedBlocks = b.nestedBlocks || [];
                  return {
                    ...b,
                    nestedBlocks: [...nestedBlocks, newBlockId]
                  };
                }
                if (b.uniqueId === newBlockId) {
                  return { ...b, x, y, parentBlock: target.blockId, parentSlot: 'nested' };
                }
                return b;
              });

              if (!draggingBlockId) {
                updated.push({
                  ...item,
                  uniqueId: newBlockId,
                  x, y,
                  parentBlock: target.blockId,
                  parentSlot: 'nested'
                });
              }

              return updated;
            });
          } else {
            // Stack below
            x = targetBlock.x;
            const blockHeight = targetBlock.acceptsNesting ? 120 : 50;
            y = targetBlock.y + blockHeight;
            
            setBlocks((prev) => {
              const updated = prev.map((b) => {
                if (b.uniqueId === newBlockId) {
                  return { ...b, x, y, connectedBelow: undefined, parentBlock: target.blockId };
                }
                if (b.uniqueId === target.blockId) {
                  return { ...b, connectedBelow: newBlockId };
                }
                return b;
              });

              if (!draggingBlockId) {
                updated.push({
                  ...item,
                  uniqueId: newBlockId,
                  x, y,
                  parentBlock: target.blockId
                });
              }

              return updated;
            });
          }
        } else {
          // Place freely on grid
          x = Math.round(x / GRID_SIZE) * GRID_SIZE;
          y = Math.round(y / GRID_SIZE) * GRID_SIZE;

          if (draggingBlockId) {
            setBlocks((prev) =>
              prev.map((b) =>
                b.uniqueId === draggingBlockId
                  ? { ...b, x, y, connectedBelow: undefined, parentBlock: undefined, parentSlot: undefined }
                  : b
              )
            );
          } else {
            setBlocks((prev) => [
              ...prev,
              {
                ...item,
                uniqueId: newBlockId,
                x, y,
              },
            ]);
          }
        }
        
        setDraggingBlockId(null);
        setSnapTarget(null);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }), [blocks, draggingBlockId, findSnapTarget]);

  const handleBlockDrag = useCallback((blockId: string) => {
    setDraggingBlockId(blockId);
  }, []);

  const renderBlock = (block: PlacedBlock): React.ReactNode => {
    const inputBlockElements: Record<string, React.ReactNode> = {};
    
    if (block.inputBlocks) {
      Object.entries(block.inputBlocks).forEach(([slotId, blockId]) => {
        const inputBlock = blocks.find(b => b.uniqueId === blockId);
        if (inputBlock) {
          inputBlockElements[slotId] = renderBlock(inputBlock);
        }
      });
    }

    const nestedContent = block.nestedBlocks?.map(nestedId => {
      const nestedBlock = blocks.find(b => b.uniqueId === nestedId);
      return nestedBlock ? (
        <div key={nestedId} className="mb-1">
          {renderBlock(nestedBlock)}
        </div>
      ) : null;
    });

    return (
      <BlockItem
        block={block}
        onDrag={() => handleBlockDrag(block.uniqueId)}
        inputBlocks={inputBlockElements}
        nestedContent={nestedContent}
      />
    );
  };

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
        // Only render top-level blocks (not nested or in slots)
        if (block.parentBlock) return null;
        
        const showSnapIndicator = snapTarget?.blockId === block.uniqueId;
        
        return (
          <div
            key={block.uniqueId}
            className="absolute"
            style={{
              left: block.x,
              top: block.y,
            }}
          >
            {showSnapIndicator && snapTarget.type === 'below' && (
              <div className="absolute -bottom-1 left-0 right-0 h-2 bg-primary/60 rounded-full animate-pulse z-10" />
            )}
            {showSnapIndicator && snapTarget.type === 'slot' && (
              <div className="absolute top-2 left-20 w-16 h-6 border-2 border-primary/60 rounded-full animate-pulse z-10" />
            )}
            {showSnapIndicator && snapTarget.type === 'nested' && (
              <div className="absolute top-12 left-4 right-4 h-12 border-2 border-primary/60 rounded animate-pulse z-10" />
            )}
            
            {renderBlock(block)}

            {/* Render connected blocks below */}
            {block.connectedBelow && (() => {
              const connectedBlock = blocks.find(b => b.uniqueId === block.connectedBelow);
              return connectedBlock ? (
                <div className="mt-1">
                  {renderBlock(connectedBlock)}
                </div>
              ) : null;
            })()}
          </div>
        );
      })}
    </div>
  );
};
