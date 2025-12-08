import { useState, useEffect } from "react";
import { BlocklyWorkspace } from "@/features/blockly";
import { SettingsPanel } from "@/components";
import { Button } from "@/components/ui/button";
import { Settings, PanelRightClose } from "lucide-react";

const Index = () => {
  const [runTour, setRunTour] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(true);
  const [leverage, setLeverage] = useState("1");

  useEffect(() => {
    // Check if user has seen the tour before
    const hasSeenTour = localStorage.getItem("hasSeenGuidedTour");
    if (!hasSeenTour) {
      // Show tour after a brief delay to let the UI load
      setTimeout(() => {
        setRunTour(true);
      }, 1000);
    }
  }, []);

  const handleStartTour = () => {
    setRunTour(true);
  };

  const handleTourComplete = () => {
    setRunTour(false);
    localStorage.setItem("hasSeenGuidedTour", "true");
  };

  const handleToggleAI = () => {
    setShowAIPanel(!showAIPanel);
  };

  const handleStepChange = (stepIndex: number) => {
    // Automatically open AI panel when moving to step 2 (index 1)
    if (stepIndex === 1) {
      setShowAIPanel(true);
    }
  };

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Center Panel - Blockly Workspace (flexible, includes backtesting panel when shown) */}
      <BlocklyWorkspace
        runTour={runTour}
        onTourComplete={handleTourComplete}
        onStepChange={handleStepChange}
        showAIPanelFromParent={showAIPanel}
        onAIPanelChange={setShowAIPanel}
        leverage={parseFloat(leverage) || 1}
      />

      {/* Right Panel - Settings (toggleable) */}
      <div className="hidden md:flex">
        {showSettingsPanel ? (
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 h-7 w-7"
              onClick={() => setShowSettingsPanel(false)}
              title="Hide Settings Panel"
            >
              <PanelRightClose className="w-4 h-4" />
            </Button>
            <SettingsPanel
              onStartTour={handleStartTour}
              onToggleAI={handleToggleAI}
              leverage={leverage}
              onLeverageChange={setLeverage}
            />
          </div>
        ) : (
          <div className="flex items-center border-l border-border bg-card p-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettingsPanel(true)}
              title="Show Settings Panel"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;

