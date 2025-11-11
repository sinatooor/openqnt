import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { BlockItem, BlockData } from "./BlockItem";
import { cn } from "@/lib/utils";

interface BlockCategoryProps {
  title: string;
  blocks: BlockData[];
  defaultOpen?: boolean;
}

export const BlockCategory = ({ title, blocks, defaultOpen = false }: BlockCategoryProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 text-foreground font-semibold text-sm mb-2 hover:text-primary transition-colors"
      >
        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        {title}
      </button>
      {isOpen && (
        <div className="space-y-2 pl-2">
          {blocks.map((block) => (
            <div key={block.id}>
              <BlockItem block={block} isInSidebar />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
