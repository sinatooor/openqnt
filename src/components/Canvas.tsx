import { useState } from "react";
import { useDrop } from "react-dnd";
import { BlockItem, BlockData } from "./BlockItem";

interface PlacedBlock extends BlockData {
  x: number;
  y: number;
}

const GRID_SIZE = 20;

export const Canvas = () => {
  const [blocks, setBlocks] = useState<PlacedBlock[]>([]);

  const [{ isOver }, drop] = useDrop(() => ({
    accept: "block",
    drop: (item: BlockData, monitor) => {
      const offset = monitor.getClientOffset();
      if (offset) {
        const canvasRect = document.getElementById("canvas")?.getBoundingClientRect();
        if (canvasRect) {
          // Snap to grid
          const x = Math.round((offset.x - canvasRect.left) / GRID_SIZE) * GRID_SIZE;
          const y = Math.round((offset.y - canvasRect.top) / GRID_SIZE) * GRID_SIZE;
          
          setBlocks((prev) => [
            ...prev,
            {
              ...item,
              id: `${item.id}-${Date.now()}`,
              x,
              y,
            },
          ]);
        }
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  return (
    <div
      id="canvas"
      ref={drop}
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
      {blocks.map((block) => (
        <div
          key={block.id}
          className="absolute"
          style={{
            left: block.x,
            top: block.y,
          }}
        >
          <BlockItem block={block} />
        </div>
      ))}
    </div>
  );
};
