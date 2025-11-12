import { useDrop } from "react-dnd";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrashBinProps {
  onDelete: (blockId: string) => void;
}

export const TrashBin = ({ onDelete }: TrashBinProps) => {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: "block",
    drop: (item: any) => {
      if (item.uniqueId) {
        onDelete(item.uniqueId);
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop() && monitor.getItem()?.isFromCanvas,
    }),
  }));

  const isActive = isOver && canDrop;

  return (
    <div
      ref={drop}
      className={cn(
        "fixed bottom-8 right-8 z-50 transition-all duration-300",
        "w-20 h-20 rounded-full flex items-center justify-center",
        "border-2 border-dashed",
        canDrop
          ? "border-destructive bg-destructive/10 scale-110"
          : "border-muted-foreground/30 bg-muted/50",
        isActive && "scale-125 bg-destructive/20 border-destructive animate-pulse"
      )}
    >
      <Trash2
        className={cn(
          "transition-all duration-300",
          canDrop ? "text-destructive w-8 h-8" : "text-muted-foreground w-6 h-6",
          isActive && "w-10 h-10"
        )}
      />
    </div>
  );
};
