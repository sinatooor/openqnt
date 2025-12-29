import { useState, useEffect, useRef } from "react";
import * as Blockly from "blockly";
import { BlocklyWorkspace } from "@/features/blockly";
import { generateCode } from "@/config/blockly/generator";

const Index = () => {
  const [runTour, setRunTour] = useState(false);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [leverage, setLeverage] = useState("1");
  const [currentXml, setCurrentXml] = useState<string | null>(null);
  const [generatedStrategyId, setGeneratedStrategyId] = useState<string | null>(null);
  const [loadedTemplateId, setLoadedTemplateId] = useState<string | null>(null);
  const [workspaceRefState, setWorkspaceRefState] = useState<Blockly.WorkspaceSvg | null>(null);

  useEffect(() => {
    // Check if user has seen the tour before
    const hasSeenTour = localStorage.getItem("hasSeenGuidedTour");
    if (!hasSeenTour) {
      setTimeout(() => {
        setRunTour(true);
      }, 1000);
    }
  }, []);

  const handleTourComplete = () => {
    setRunTour(false);
    localStorage.setItem("hasSeenGuidedTour", "true");
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
        onWorkspaceRef={setWorkspaceRefState}
      />
    </div>
  );
};

export default Index;

