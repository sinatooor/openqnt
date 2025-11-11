import { BlockCategory } from "./BlockCategory";
import { BlockData } from "./BlockItem";

const environmentBlocks: BlockData[] = [
  { id: "env-1", type: "environment", label: "Price", shape: "pill" },
  { id: "env-2", type: "environment", label: "Spread", shape: "pill" },
  { id: "env-3", type: "environment", label: "Prev. open", shape: "pill", hasInput: true },
  { id: "env-4", type: "environment", label: "Prev. close", shape: "pill", hasInput: true },
  { id: "env-5", type: "environment", label: "Is market open?", shape: "pill" },
  { id: "env-6", type: "environment", label: "Time", shape: "pill" },
  { id: "env-7", type: "environment", label: "Day of week", shape: "pill" },
  { id: "env-8", type: "environment", label: "New candle open", shape: "pill", hasInput: true },
  { id: "env-9", type: "environment", label: "New candle close", shape: "pill", hasInput: true },
];

const operatorBlocks: BlockData[] = [
  { id: "op-1", type: "operator", label: "AND", shape: "pill" },
  { id: "op-2", type: "operator", label: "OR", shape: "pill" },
  { id: "op-3", type: "operator", label: "NOT", shape: "pill" },
  { id: "op-4", type: "operator", label: ">", shape: "pill" },
  { id: "op-5", type: "operator", label: "<", shape: "pill" },
  { id: "op-6", type: "operator", label: "=", shape: "pill" },
  { id: "op-7", type: "operator", label: "≥", shape: "pill" },
  { id: "op-8", type: "operator", label: "≤", shape: "pill" },
  { id: "op-9", type: "operator", label: "+", shape: "pill" },
  { id: "op-10", type: "operator", label: "-", shape: "pill" },
  { id: "op-11", type: "operator", label: "×", shape: "pill" },
  { id: "op-12", type: "operator", label: "÷", shape: "pill" },
  { id: "op-13", type: "operator", label: "Mod", shape: "pill" },
];

const controlBlocks: BlockData[] = [
  { id: "ctrl-1", type: "control", label: "Define function", shape: "block", hasInput: true, inputLabel: "Name" },
  { id: "ctrl-2", type: "control", label: "Define", shape: "block", hasInput: true, inputLabel: "as" },
  { id: "ctrl-3", type: "control", label: "Start", shape: "block" },
  { id: "ctrl-4", type: "control", label: "Call function", shape: "block" },
  { id: "ctrl-5", type: "control", label: "Run function", shape: "block", hasInput: true, inputLabel: "Name" },
  { id: "ctrl-6", type: "control", label: "Return", shape: "block", hasInput: true },
  { id: "ctrl-7", type: "control", label: "Repeat until", shape: "block", hasInput: true },
  { id: "ctrl-8", type: "control", label: "Repeat", shape: "block", hasInput: true, inputLabel: "times" },
  { id: "ctrl-9", type: "control", label: "Repeat forever", shape: "block" },
  { id: "ctrl-10", type: "control", label: "If", shape: "block", hasInput: true, inputLabel: "then:" },
  { id: "ctrl-11", type: "control", label: "Otherwise:", shape: "block" },
  { id: "ctrl-12", type: "control", label: "Wait until", shape: "block", hasInput: true },
  { id: "ctrl-13", type: "control", label: "Wait for", shape: "block", hasInput: true, inputLabel: "seconds" },
  { id: "ctrl-14", type: "control", label: "Stop", shape: "block" },
];

const tradeBlocks: BlockData[] = [
  { id: "trade-1", type: "trade", label: "Trade", shape: "block", hasInput: true, inputLabel: "long" },
  { id: "trade-2", type: "trade", label: "Size", shape: "block", hasInput: true, inputLabel: "value" },
  { id: "trade-3", type: "trade", label: "Leverage", shape: "block", hasInput: true, inputLabel: "contracts" },
  { id: "trade-4", type: "trade", label: "Stop loss at", shape: "block", hasInput: true, inputLabel: "for" },
  { id: "trade-5", type: "trade", label: "Take profit at", shape: "block", hasInput: true, inputLabel: "for" },
  { id: "trade-6", type: "trade", label: "Close", shape: "block", hasInput: true, inputLabel: "% of" },
  { id: "trade-7", type: "trade", label: "P&L of", shape: "block", hasInput: true },
  { id: "trade-8", type: "trade", label: "Entry price of", shape: "block" },
  { id: "trade-9", type: "trade", label: "Position size of", shape: "block", hasInput: true },
];

const taBlocks: BlockData[] = [
  { id: "ta-1", type: "ta", label: "Support level", shape: "pill", hasInput: true, inputLabel: "Close" },
  { id: "ta-2", type: "ta", label: "Resistance level", shape: "pill", hasInput: true, inputLabel: "Close" },
  { id: "ta-3", type: "ta", label: "RSI", shape: "pill", hasInput: true },
  { id: "ta-4", type: "ta", label: "MACD", shape: "pill", hasInput: true },
  { id: "ta-5", type: "ta", label: "SMA", shape: "pill", hasInput: true },
  { id: "ta-6", type: "ta", label: "ATR", shape: "pill", hasInput: true },
  { id: "ta-7", type: "ta", label: "VWAP", shape: "pill", hasInput: true },
];

export const BlocksSidebar = () => {
  return (
    <div className="w-64 bg-card border-r border-border h-full overflow-y-auto p-4">
      <BlockCategory title="Environment" blocks={environmentBlocks} defaultOpen />
      <BlockCategory title="Operators" blocks={operatorBlocks} />
      <BlockCategory title="Control" blocks={controlBlocks} />
      <BlockCategory title="Trade" blocks={tradeBlocks} />
      <BlockCategory title="TA Tools" blocks={taBlocks} />
    </div>
  );
};
