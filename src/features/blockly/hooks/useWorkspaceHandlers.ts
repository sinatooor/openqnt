/**
 * Custom hook for workspace operation handlers
 * Handles save, load, undo, redo, and template operations
 */

import * as Blockly from "blockly";
import { toast } from "sonner";
import { StrategyTemplate } from "@/features/templates/strategyTemplates";

interface UseWorkspaceHandlersProps {
  workspaceRef: React.RefObject<Blockly.WorkspaceSvg | null>;
}

export const useWorkspaceHandlers = ({ workspaceRef }: UseWorkspaceHandlersProps) => {
  const handleSaveWorkspace = () => {
    if (!workspaceRef.current) return;
    const xml = Blockly.Xml.workspaceToDom(workspaceRef.current);
    const xmlText = Blockly.Xml.domToText(xml);
    const blob = new Blob([xmlText], {
      type: "application/xml",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "trading-strategy-blocks.xml";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Workspace saved successfully!");
  };

  const handleLoadWorkspace = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".xml";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !workspaceRef.current) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const xmlText = event.target?.result as string;
          const xml = Blockly.utils.xml.textToDom(xmlText);
          workspaceRef.current?.clear();
          Blockly.Xml.domToWorkspace(xml, workspaceRef.current!);
          toast.success("Workspace loaded successfully!");
        } catch (error) {
          toast.error("Failed to load workspace. Invalid file format.");
          console.error(error);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleLoadTemplate = (template: StrategyTemplate) => {
    if (!workspaceRef.current) return;
    try {
      const xml = Blockly.utils.xml.textToDom(template.workspace);
      workspaceRef.current.clear();
      Blockly.Xml.domToWorkspace(xml, workspaceRef.current);
      toast.success(`${template.name} template loaded successfully!`, {
        description: template.description,
        duration: 4000,
      });
    } catch (error) {
      toast.error("Failed to load template.");
      console.error(error);
    }
  };

  const handleUndo = () => {
    if (!workspaceRef.current) return;
    workspaceRef.current.undo(false);
  };

  const handleRedo = () => {
    if (!workspaceRef.current) return;
    workspaceRef.current.undo(true);
  };

  const handleCenterWorkspace = () => {
    if (!workspaceRef.current) return;
    workspaceRef.current.scrollCenter();
    toast.success("Workspace centered");
  };

  return {
    handleSaveWorkspace,
    handleLoadWorkspace,
    handleLoadTemplate,
    handleUndo,
    handleRedo,
    handleCenterWorkspace,
  };
};
