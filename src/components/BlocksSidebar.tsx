import { useState } from "react";
import { BlockItem, BlockData } from "./BlockItem";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const environmentBlocks: BlockData[] = [
  { id: "env-1", type: "environment", label: "Price", shape: "pill" },
  { id: "env-2", type: "environment", label: "Volume", shape: "pill" },
  { id: "env-3", type: "environment", label: "Time", shape: "pill" },
  { id: "env-4", type: "environment", label: "Spread", shape: "pill" },
];

export const operatorBlocks: BlockData[] = [
  { 
    id: "op-1", 
    type: "operator", 
    label: "=", 
    shape: "pill",
    inputs: [
      { id: "left", acceptsValue: true, acceptsText: true },
      { id: "right", acceptsValue: true, acceptsText: true }
    ]
  },
  { 
    id: "op-2", 
    type: "operator", 
    label: ">", 
    shape: "pill",
    inputs: [
      { id: "left", acceptsValue: true, acceptsText: true },
      { id: "right", acceptsValue: true, acceptsText: true }
    ]
  },
  { 
    id: "op-3", 
    type: "operator", 
    label: "<", 
    shape: "pill",
    inputs: [
      { id: "left", acceptsValue: true, acceptsText: true },
      { id: "right", acceptsValue: true, acceptsText: true }
    ]
  },
  { 
    id: "op-4", 
    type: "operator", 
    label: "+", 
    shape: "pill",
    inputs: [
      { id: "left", acceptsValue: true, acceptsText: true },
      { id: "right", acceptsValue: true, acceptsText: true }
    ]
  },
  { 
    id: "op-5", 
    type: "operator", 
    label: "-", 
    shape: "pill",
    inputs: [
      { id: "left", acceptsValue: true, acceptsText: true },
      { id: "right", acceptsValue: true, acceptsText: true }
    ]
  },
  { 
    id: "op-6", 
    type: "operator", 
    label: "×", 
    shape: "pill",
    inputs: [
      { id: "left", acceptsValue: true, acceptsText: true },
      { id: "right", acceptsValue: true, acceptsText: true }
    ]
  },
  { 
    id: "op-7", 
    type: "operator", 
    label: "÷", 
    shape: "pill",
    inputs: [
      { id: "left", acceptsValue: true, acceptsText: true },
      { id: "right", acceptsValue: true, acceptsText: true }
    ]
  },
  { 
    id: "op-8", 
    type: "operator", 
    label: "AND", 
    shape: "pill",
    inputs: [
      { id: "left", acceptsValue: true },
      { id: "right", acceptsValue: true }
    ]
  },
  { 
    id: "op-9", 
    type: "operator", 
    label: "OR", 
    shape: "pill",
    inputs: [
      { id: "left", acceptsValue: true },
      { id: "right", acceptsValue: true }
    ]
  },
];

export const controlBlocks: BlockData[] = [
  { 
    id: "ctrl-1", 
    type: "control", 
    label: "If", 
    shape: "block",
    inputs: [{ id: "condition", acceptsValue: true, label: "condition" }],
    acceptsNesting: true,
    nestingLabel: "then"
  },
  { 
    id: "ctrl-2", 
    type: "control", 
    label: "Repeat", 
    shape: "block",
    inputs: [{ id: "times", acceptsText: true, label: "times" }],
    acceptsNesting: true,
    nestingLabel: "do"
  },
  { 
    id: "ctrl-3", 
    type: "control", 
    label: "Wait", 
    shape: "block",
    inputs: [{ id: "seconds", acceptsText: true, label: "seconds" }]
  },
  { 
    id: "ctrl-4", 
    type: "control", 
    label: "Forever", 
    shape: "block",
    acceptsNesting: true,
    nestingLabel: "do"
  },
];

export const tradeBlocks: BlockData[] = [
  { 
    id: "trade-1", 
    type: "trade", 
    label: "Buy", 
    shape: "block",
    inputs: [{ id: "amount", acceptsText: true, acceptsValue: true, label: "amount" }]
  },
  { 
    id: "trade-2", 
    type: "trade", 
    label: "Sell", 
    shape: "block",
    inputs: [{ id: "amount", acceptsText: true, acceptsValue: true, label: "amount" }]
  },
  { 
    id: "trade-3", 
    type: "trade", 
    label: "Stop Loss", 
    shape: "block",
    inputs: [{ id: "percent", acceptsText: true, label: "%" }]
  },
  { 
    id: "trade-4", 
    type: "trade", 
    label: "Take Profit", 
    shape: "block",
    inputs: [{ id: "percent", acceptsText: true, label: "%" }]
  },
];

export const taBlocks: BlockData[] = [
  { 
    id: "ta-1", 
    type: "ta", 
    label: "SMA", 
    shape: "pill",
    inputs: [{ id: "period", acceptsText: true, label: "period" }]
  },
  { 
    id: "ta-2", 
    type: "ta", 
    label: "EMA", 
    shape: "pill",
    inputs: [{ id: "period", acceptsText: true, label: "period" }]
  },
  { 
    id: "ta-3", 
    type: "ta", 
    label: "RSI", 
    shape: "pill",
    inputs: [{ id: "period", acceptsText: true, label: "period" }]
  },
  { 
    id: "ta-4", 
    type: "ta", 
    label: "MACD", 
    shape: "pill" 
  },
  { 
    id: "ta-5", 
    type: "ta", 
    label: "BB", 
    shape: "pill",
    inputs: [{ id: "period", acceptsText: true, label: "period" }]
  },
];

type Category = "environment" | "operators" | "control" | "trade" | "ta";

interface CategoryData {
  id: Category;
  label: string;
  blocks: BlockData[];
}

const categories: CategoryData[] = [
  { id: "environment", label: "Environment", blocks: environmentBlocks },
  { id: "operators", label: "Operators", blocks: operatorBlocks },
  { id: "control", label: "Control", blocks: controlBlocks },
  { id: "trade", label: "Trade", blocks: tradeBlocks },
  { id: "ta", label: "TA Tools", blocks: taBlocks },
];

export const BlocksSidebar = () => {
  const [selectedCategory, setSelectedCategory] = useState<Category>("environment");

  const currentBlocks = categories.find((c) => c.id === selectedCategory)?.blocks || [];

  return (
    <div className="flex h-full border-r border-border">
      {/* Category buttons sidebar */}
      <div className="w-24 bg-secondary flex flex-col gap-2 p-2 border-r border-border">
        {categories.map((category) => (
          <Button
            key={category.id}
            variant={selectedCategory === category.id ? "default" : "ghost"}
            className={cn(
              "h-16 flex flex-col items-center justify-center text-xs font-semibold p-2 whitespace-normal",
              selectedCategory === category.id && "bg-primary"
            )}
            onClick={() => setSelectedCategory(category.id)}
          >
            <span className="text-center leading-tight">
              {category.label}
            </span>
          </Button>
        ))}
      </div>

      {/* Blocks panel */}
      <div className="w-64 bg-card overflow-y-auto p-4">
        <h3 className="font-bold text-lg mb-4 text-foreground">
          {categories.find((c) => c.id === selectedCategory)?.label}
        </h3>
        <div className="space-y-2">
          {currentBlocks.map((block) => (
            <div key={block.id}>
              <BlockItem block={block} isInSidebar />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
