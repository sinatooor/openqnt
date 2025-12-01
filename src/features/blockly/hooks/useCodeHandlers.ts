/**
 * Custom hook for handling code-related operations (copy, export, beautify)
 */

import { useState } from "react";
import { toast } from "sonner";

interface UseCodeHandlersProps {
  generatedCode: string;
  setCopied: (copied: boolean) => void;
}

export const useCodeHandlers = ({
  generatedCode,
  setCopied,
}: UseCodeHandlersProps) => {
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      toast.success("Code Copied", {
        description: "Strategy code copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy code");
    }
  };

  return {
    handleCopyCode,
  };
};
