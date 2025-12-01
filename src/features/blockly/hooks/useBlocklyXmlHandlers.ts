/**
 * Custom hook for handling Blockly XML operations
 */

import { MutableRefObject } from "react";
import * as Blockly from "blockly";
import { toast } from "sonner";

interface UseBlocklyXmlHandlersProps {
  workspaceRef: MutableRefObject<Blockly.WorkspaceSvg | null>;
  setBlockCount: (count: number) => void;
  setIsEmpty: (isEmpty: boolean) => void;
  setPendingXml: (xml: string | null) => void;
  setShowConfirmDialog: (show: boolean) => void;
  pendingXml: string | null;
}

export const useBlocklyXmlHandlers = ({
  workspaceRef,
  setBlockCount,
  setIsEmpty,
  setPendingXml,
  setShowConfirmDialog,
  pendingXml,
}: UseBlocklyXmlHandlersProps) => {
  const loadXmlToWorkspace = (xml: string, clearFirst: boolean = false) => {
    if (!workspaceRef.current) return;
    try {
      // Extract XML content if it's wrapped in markdown code blocks or surrounded by text
      let cleanXml = xml.trim();

      // Remove markdown code blocks
      if (cleanXml.includes('```xml')) {
        cleanXml = cleanXml.replace(/```xml\n?/g, '').replace(/```/g, '').trim();
      }

      // Extract XML using regex (in case AI added explanation text before/after)
      const xmlMatch = cleanXml.match(/<xml[^>]*>[\s\S]*<\/xml>/i);
      if (xmlMatch) {
        cleanXml = xmlMatch[0];
      }

      // Validate XML format
      if (!cleanXml.startsWith('<xml')) {
        console.error("Invalid XML format - doesn't start with <xml>:", cleanXml.substring(0, 100));
        toast.error("Invalid XML format", {
          description: "The generated blocks are not in the correct format. Please try again."
        });
        return;
      }
      if (!cleanXml.includes('</xml>')) {
        console.error("Invalid XML format - missing closing tag:", cleanXml.substring(0, 100));
        toast.error("Incomplete XML", {
          description: "The generated blocks are incomplete. Please try again."
        });
        return;
      }

      // CRITICAL: Validate XML can be parsed BEFORE clearing workspace
      const xmlDom = Blockly.utils.xml.textToDom(cleanXml);

      // Only clear workspace AFTER validation succeeds
      if (clearFirst) {
        workspaceRef.current.clear();
      }

      // Now load the already-validated XML
      Blockly.Xml.domToWorkspace(xmlDom, workspaceRef.current);
      const allBlocks = workspaceRef.current.getAllBlocks(false);
      setIsEmpty(allBlocks.length === 0);
      setBlockCount(allBlocks.length);
    } catch (error) {
      // DON'T clear workspace if we got here - preserves existing blocks
      console.error("Error loading XML:", error);
      console.error("Failed XML content:", xml.substring(0, 500));

      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // More specific error messages
      let description = "Could not load the generated blocks. Your existing workspace was preserved.";
      if (errorMessage.includes("doesn't exist")) {
        description = `Block structure error: ${errorMessage}. This may be due to incompatible block connections. Your workspace was preserved.`;
      } else if (errorMessage.includes("XML")) {
        description = "The generated blocks have invalid XML format. Your workspace was preserved.";
      }

      toast.error("Failed to load blocks", { description });
    }
  };

  const handleBlocksGenerated = (xml: string, isEdit: boolean = false) => {
    if (!workspaceRef.current) return;
    const hasBlocks = workspaceRef.current.getAllBlocks(false).length > 0;
    if (!hasBlocks || isEdit) {
      // Workspace is empty or this is an edit - replace/add blocks directly
      loadXmlToWorkspace(xml, isEdit);
      toast.success(isEdit ? "Strategy Updated" : "Strategy Added", {
        description: isEdit ? "Your blocks have been updated with the changes." : "AI-generated blocks have been added to your workspace."
      });
    } else {
      // Workspace has blocks, ask user first
      setPendingXml(xml);
      setShowConfirmDialog(true);
    }
  };

  const handleConfirmAdd = () => {
    if (pendingXml) {
      loadXmlToWorkspace(pendingXml);
      setPendingXml(null);
      toast.success("Strategy Added", {
        description: "AI-generated blocks have been added to your workspace."
      });
    }
    setShowConfirmDialog(false);
  };

  const handleCancelAdd = () => {
    setPendingXml(null);
    setShowConfirmDialog(false);
  };

  return {
    loadXmlToWorkspace,
    handleBlocksGenerated,
    handleConfirmAdd,
    handleCancelAdd,
  };
};
