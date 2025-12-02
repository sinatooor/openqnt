/**
 * Custom hook for code operation handlers
 * Handles copy, export, and run operations
 */

import { toast } from "sonner";

interface UseCodeHandlersProps {
  generatedCode: string;
  setCopied: (copied: boolean) => void;
}

export const useCodeHandlers = ({
  generatedCode,
  setCopied,
}: UseCodeHandlersProps) => {
  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    toast.success("Code copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCode = () => {
    if (!generatedCode) {
      toast.error("No code to export. Add blocks to your workspace first.");
      return;
    }
    const blob = new Blob([generatedCode], {
      type: "text/javascript",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "trading-strategy.js";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Strategy exported successfully!");
  };

  const handleRunStrategy = () => {
    if (!generatedCode) {
      toast.error("No strategy to run. Add blocks to your workspace first.");
      return;
    }
    toast.info(
      "Strategy execution would run here. Connect to a trading platform to execute live."
    );
    console.log("Generated Strategy Code:\n", generatedCode);
  };

  return {
    handleCopyCode,
    handleExportCode,
    handleRunStrategy,
  };
};
