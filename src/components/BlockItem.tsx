import { useDrag } from "react-dnd";
import { cn } from "@/lib/utils";

export type BlockType = "environment" | "operator" | "control" | "trade" | "ta";

export interface BlockData {
  id: string;
  type: BlockType;
  label: string;
  hasInput?: boolean;
  inputLabel?: string;
  shape?: "pill" | "block";
}

interface BlockItemProps {
  block: BlockData;
  isInSidebar?: boolean;
}

export const BlockItem = ({ block, isInSidebar = false }: BlockItemProps) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: "block",
    item: block,
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  const isPill = block.shape === "pill";

  const colorClasses = {
    environment: "bg-block-environment text-block-environment-foreground",
    operator: "bg-block-operator text-block-operator-foreground",
    control: "bg-block-control text-block-control-foreground",
    trade: "bg-block-trade text-block-trade-foreground",
    ta: "bg-block-ta text-block-ta-foreground",
  };

  return (
    <div
      ref={drag}
      className={cn(
        "cursor-move select-none transition-opacity font-medium text-sm",
        isDragging && "opacity-50",
        isPill
          ? cn(
              "px-3 py-1.5 rounded-full inline-flex items-center gap-2",
              colorClasses[block.type]
            )
          : cn(
              "px-4 py-2 rounded-md flex items-center gap-2 min-h-[40px]",
              colorClasses[block.type]
            )
      )}
    >
      <span>{block.label}</span>
      {block.hasInput && (
        <input
          type="text"
          placeholder={block.inputLabel || "value"}
          className="bg-white/20 rounded px-2 py-0.5 text-xs w-20 border-0 focus:outline-none focus:ring-1 focus:ring-white/40"
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
};
