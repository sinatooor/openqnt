/**
 * Custom hook for managing Blockly workspace state
 */

import { useRef, useState } from "react";
import * as Blockly from "blockly";
import { LogEntry } from "@/components/DevLogPanel";

export const useBlocklyState = () => {
  const blocklyDiv = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const aiPanelRef = useRef<HTMLDivElement>(null);

  const [generatedCode, setGeneratedCode] = useState<string>("");
  const [blockCount, setBlockCount] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [isEmpty, setIsEmpty] = useState(true);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [beautified, setBeautified] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [strategyName, setStrategyName] = useState("Untitled Strategy");
  const [isEditingName, setIsEditingName] = useState(false);

  // Block dragging state
  const [isDraggingBlock, setIsDraggingBlock] = useState(false);
  const [draggedBlockData, setDraggedBlockData] = useState<{
    xml: string;
    name: string;
  } | null>(null);

  // Dev logs
  const [devLogs, setDevLogs] = useState<LogEntry[]>([]);

  // Pending XML for confirmation
  const [pendingXml, setPendingXml] = useState<string | null>(null);

  return {
    // Refs
    blocklyDiv,
    workspaceRef,
    aiPanelRef,

    // Generated code
    generatedCode,
    setGeneratedCode,

    // Block stats
    blockCount,
    setBlockCount,
    isEmpty,
    setIsEmpty,

    // Zoom
    zoomLevel,
    setZoomLevel,

    // Code display options
    showLineNumbers,
    setShowLineNumbers,
    beautified,
    setBeautified,
    copied,
    setCopied,

    // Backtesting
    isBacktesting,
    setIsBacktesting,

    // Strategy name
    strategyName,
    setStrategyName,
    isEditingName,
    setIsEditingName,

    // Block dragging
    isDraggingBlock,
    setIsDraggingBlock,
    draggedBlockData,
    setDraggedBlockData,

    // Dev logs
    devLogs,
    setDevLogs,

    // Pending XML
    pendingXml,
    setPendingXml,
  };
};
