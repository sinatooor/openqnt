/**
 * Custom hook for handling workspace file operations (save, load, undo, redo)
 */

import { MutableRefObject } from "react";
import * as Blockly from "blockly";
import { toast } from "sonner";

interface UseWorkspaceHandlersProps {
  workspaceRef: MutableRefObject<Blockly.WorkspaceSvg | null>;
  strategyName: string;
  setBlockCount: (count: number) => void;
  setIsEmpty: (isEmpty: boolean) => void;
}

export const useWorkspaceHandlers = ({
  workspaceRef,
  strategyName,
  setBlockCount,
  setIsEmpty,
}: UseWorkspaceHandlersProps) => {
  const handleSaveWorkspace = () => {
    if (!workspaceRef.current) return;
    const xml = Blockly.Xml.workspaceToDom(workspaceRef.current);
    const xmlText = Blockly.Xml.domToText(xml);
    const blob = new Blob([xmlText], { type: "text/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${strategyName.replace(/\s+/g, "_")}.xml`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Workspace Saved", {
      description: `Strategy saved as ${a.download}`,
    });
  };

  const handleLoadWorkspace = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xml";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const xmlText = e.target?.result as string;
          if (workspaceRef.current) {
            workspaceRef.current.clear();
            const xml = Blockly.utils.xml.textToDom(xmlText);
            Blockly.Xml.domToWorkspace(xml, workspaceRef.current);
            
            // Update stats
            const allBlocks = workspaceRef.current.getAllBlocks(false);
            setBlockCount(allBlocks.length);
            setIsEmpty(allBlocks.length === 0);
            
            toast.success("Workspace Loaded", {
              description: "Strategy loaded successfully",
            });
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleUndo = () => {
    if (!workspaceRef.current) return;
    workspaceRef.current.undo(false);
    
    // Update stats after undo
    const allBlocks = workspaceRef.current.getAllBlocks(false);
    setBlockCount(allBlocks.length);
    setIsEmpty(allBlocks.length === 0);
  };

  const handleRedo = () => {
    if (!workspaceRef.current) return;
    workspaceRef.current.undo(true);
    
    // Update stats after redo
    const allBlocks = workspaceRef.current.getAllBlocks(false);
    setBlockCount(allBlocks.length);
    setIsEmpty(allBlocks.length === 0);
  };

  return {
    handleSaveWorkspace,
    handleLoadWorkspace,
    handleUndo,
    handleRedo,
  };
};
