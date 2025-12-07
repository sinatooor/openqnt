/**
 * Custom hook for managing UI panel visibility states
 */

import { useState, useEffect } from "react";

interface UsePanelVisibilityProps {
  showAIPanelFromParent?: boolean;
  onAIPanelChange?: (show: boolean) => void;
}

export const usePanelVisibility = ({
  showAIPanelFromParent,
  onAIPanelChange,
}: UsePanelVisibilityProps = {}) => {
  const [showCode, setShowCode] = useState(false);
  const [showBacktest, setShowBacktest] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showFloatingChart, setShowFloatingChart] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDevLogs, setShowDevLogs] = useState(() => {
    return localStorage.getItem("showDevLogs") === "true";
  });
  const [showSearch, setShowSearch] = useState(false);
  const [showAdvancedLogic, setShowAdvancedLogic] = useState(false);
  const [showIndicatorSettings, setShowIndicatorSettings] = useState(false);

  // Sync AI panel with parent
  useEffect(() => {
    if (showAIPanelFromParent !== undefined) {
      setShowAIPanel(showAIPanelFromParent);
    }
  }, [showAIPanelFromParent]);

  // Notify parent when AI panel changes locally
  useEffect(() => {
    if (onAIPanelChange) {
      onAIPanelChange(showAIPanel);
    }
  }, [showAIPanel, onAIPanelChange]);

  return {
    // Code panel
    showCode,
    setShowCode,

    // Backtest panel
    showBacktest,
    setShowBacktest,

    // Templates dialog
    showTemplates,
    setShowTemplates,

    // Floating chart
    showFloatingChart,
    setShowFloatingChart,

    // AI panel
    showAIPanel,
    setShowAIPanel,

    // Confirmation dialog
    showConfirmDialog,
    setShowConfirmDialog,

    // Dev logs
    showDevLogs,
    setShowDevLogs,

    // Search dialog
    showSearch,
    setShowSearch,

    // Advanced logic modal
    showAdvancedLogic,
    setShowAdvancedLogic,

    // Indicator settings modal
    showIndicatorSettings,
    setShowIndicatorSettings,
  };
};
