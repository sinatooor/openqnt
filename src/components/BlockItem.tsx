import { useDrag } from "react-dnd";
import { cn } from "@/lib/utils";

export type BlockType = "environment" | "operator" | "control" | "trade" | "ta";

export interface InputSlot {
  id: string;
  label?: string;
  acceptsValue?: boolean; // Can accept pill blocks
  acceptsText?: boolean; // Can accept text input
}

export interface BlockData {
  id: string;
  type: BlockType;
  label: string;
  shape?: "pill" | "block";
  inputs?: InputSlot[]; // Input slots for this block
  acceptsNesting?: boolean; // For control blocks (if, repeat)
  nestingLabel?: string; // Label for nesting area (e.g., "do", "then", "else")
}

interface BlockItemProps {
  block: BlockData & { uniqueId?: string };
  isInSidebar?: boolean;
  onDrag?: () => void;
  inputBlocks?: Record<string, React.ReactNode>;
  nestedContent?: React.ReactNode;
  onInputClick?: (slotId: string) => void;
}

export const BlockItem = ({ 
  block, 
  isInSidebar = false, 
  onDrag,
  inputBlocks = {},
  nestedContent,
  onInputClick 
}: BlockItemProps) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: "block",
    item: { ...block, isFromCanvas: !isInSidebar },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [block, isInSidebar]);

  if (isDragging && onDrag) {
    onDrag();
  }

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
              "px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 whitespace-nowrap",
              colorClasses[block.type]
            )
          : cn(
              "px-4 py-2 rounded-md min-h-[40px]",
              colorClasses[block.type]
            )
      )}
    >
      {isPill ? (
        <div className="flex items-center gap-1.5">
          <span>{block.label}</span>
          {block.inputs?.map((input) => (
            <div key={input.id} className="inline-flex items-center">
              {inputBlocks[input.id] || (
                <input
                  type="text"
                  placeholder={input.label || ""}
                  className="bg-white/20 rounded-full px-2 py-0.5 text-xs w-16 border-0 focus:outline-none focus:ring-1 focus:ring-white/40"
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1 w-full">
          <div className="flex items-center gap-2 flex-wrap">
            <span>{block.label}</span>
            {block.inputs?.map((input) => (
              <div 
                key={input.id} 
                className="inline-flex items-center relative"
                onClick={() => !isInSidebar && onInputClick?.(input.id)}
              >
                {inputBlocks[input.id] || (
                  input.acceptsText ? (
                    <input
                      type="text"
                      placeholder={input.label || ""}
                      className="bg-white/20 rounded px-2 py-0.5 text-xs w-20 border-0 focus:outline-none focus:ring-1 focus:ring-white/40"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className="bg-white/10 rounded-full px-3 py-1 text-xs border border-white/20 min-w-[60px] text-center">
                      {input.label || "empty"}
                    </div>
                  )
                )}
              </div>
            ))}
          </div>
          {block.acceptsNesting && nestedContent && (
            <div className="ml-4 mt-1 pl-3 border-l-2 border-white/30 py-2 min-h-[50px]">
              {nestedContent}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
