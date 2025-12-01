import { useState, useEffect } from "react";
import { BlocklyWorkspace } from "@/features/blockly/components/BlocklyWorkspace";
import { SettingsPanel } from "@/components/SettingsPanel";

const Index = () => {
  const [runTour, setRunTour] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);

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
      />
      
      {/* Right Panel - Settings (hidden on mobile, shown on tablet+) */}
      <div className="hidden md:block">
        <SettingsPanel 
          onStartTour={handleStartTour}
          onToggleAI={handleToggleAI}
        />
      </div>
    </div>
  );
};

export default Index;
