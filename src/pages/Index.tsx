import { useState, useEffect, useRef } from "react";
import { BlocklyWorkspace } from "@/features/blockly";
import { SettingsPanel } from "@/components";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";

const Index = () => {
  const [runTour, setRunTour] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [showSettingsPanel, setShowSettingsPanel] = useState(true);
  const [leverage, setLeverage] = useState("1");
  const [currentXml, setCurrentXml] = useState<string | null>(null);

  useEffect(() => {
    // Check if user has seen the tour before
    const hasSeenTour = localStorage.getItem("hasSeenGuidedTour");
    if (!hasSeenTour) {
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
    if (stepIndex === 1) {
      setShowAIPanel(true);
    }
  };

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Center Panel - Blockly Workspace */}
      <BlocklyWorkspace
        runTour={runTour}
        onTourComplete={handleTourComplete}
        onStepChange={handleStepChange}
        showAIPanelFromParent={showAIPanel}
        onAIPanelChange={setShowAIPanel}
        leverage={parseFloat(leverage) || 1}
        onXmlChange={setCurrentXml}
      />

      {/* Right Panel - Settings (toggleable) */}
      <div className="hidden md:flex">
        {showSettingsPanel ? (
          <SettingsPanel
            onStartTour={handleStartTour}
            onToggleAI={handleToggleAI}
            onClose={() => setShowSettingsPanel(false)}
            leverage={leverage}
            onLeverageChange={setLeverage}
            getWorkspaceXml={() => currentXml}
          />
        ) : (
          <div className="flex flex-col items-center border-l border-border bg-card px-2 py-4 gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettingsPanel(true)}
              title="Show Settings Panel"
              className="flex flex-col items-center gap-1 h-auto py-2"
            >
              <Settings className="w-5 h-5" />
              <span className="text-xs">Settings</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;
