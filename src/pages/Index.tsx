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
  const [generatedStrategyId, setGeneratedStrategyId] = useState<string | null>(null);
  const [loadedTemplateId, setLoadedTemplateId] = useState<string | null>(null);

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

  // Store the template's original XML structure for comparison
  const [templateOriginalXml, setTemplateOriginalXml] = useState<string | null>(null);

  const handleXmlChange = (xml: string | null) => {
    setCurrentXml(xml);

    // If we have a generated strategy ID and the XML changes (user edit), 
    // we must invalidate the ID so we don't backtest stale code.
    if (generatedStrategyId) {
      setGeneratedStrategyId(null);
    }

    // For templates: only clear templateId if STRUCTURE changed, not just params
    if (loadedTemplateId && templateOriginalXml && xml) {
      // Import structure comparison dynamically to avoid circular deps
      import('@/utils/xmlStructure').then(({ hasStructureChanged }) => {
        if (hasStructureChanged(templateOriginalXml, xml)) {
          setLoadedTemplateId(null);
          setTemplateOriginalXml(null);
          console.log("[TEMPLATE] Structure changed - cleared template ID");
        } else {
          console.log("[TEMPLATE] Only params changed - keeping template ID");
        }
      });
    } else if (loadedTemplateId && !templateOriginalXml) {
      // Fallback: if we don't have original XML, clear template ID
      setLoadedTemplateId(null);
      console.log("[TEMPLATE] Cleared template ID (no original XML to compare)");
    }
  };

  const handleStrategyGenerated = (id: string, code?: string) => {
    console.log("Strategy generated with ID:", id);
    setGeneratedStrategyId(id);
  };

  const handleTemplateLoaded = (templateId: string, templateXml?: string) => {
    console.log("[TEMPLATE] Loaded template:", templateId);
    setLoadedTemplateId(templateId);
    // Store the template's original XML for structure comparison
    if (templateXml) {
      setTemplateOriginalXml(templateXml);
    }
    // Clear strategy ID since we're using a template
    setGeneratedStrategyId(null);
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
        onXmlChange={handleXmlChange}
        onStrategyGenerated={handleStrategyGenerated}
        onTemplateLoaded={handleTemplateLoaded}
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
            generatedStrategyId={generatedStrategyId}
            loadedTemplateId={loadedTemplateId}
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
