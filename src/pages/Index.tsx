import { useState, useEffect, useRef, lazy, Suspense } from "react";
import * as Blockly from "blockly";
import { BlocklyWorkspace } from "@/features/blockly";
import { generateCode } from "@/config/blockly/generator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Puzzle, GitBranch, Loader2 } from "lucide-react";

// Lazy load the Pipeline canvas for code splitting
const PipelineCanvas = lazy(() => 
  import("@/features/pipeline").then(m => ({ default: m.PipelineCanvas }))
);

type ViewMode = "blockly" | "pipeline";

const Index = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("pipeline");
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

  const handleStartTour = () => {
    setRunTour(true);
  };

  // Listen for custom event to open Blockly editor from Pipeline nodes
  useEffect(() => {
    const handleOpenBlocklyEditor = (e: CustomEvent) => {
      console.log("[Pipeline] Open Blockly editor for node:", e.detail?.nodeId);
      // Switch to Blockly view when editing a strategy node
      setViewMode("blockly");
      // Could also load specific strategy XML here if needed
    };

    window.addEventListener("pipeline:openBlocklyEditor", handleOpenBlocklyEditor as EventListener);
    return () => {
      window.removeEventListener("pipeline:openBlocklyEditor", handleOpenBlocklyEditor as EventListener);
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden relative">
      {/* View Mode Tabs */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-card/50">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
          <TabsList className="h-8">
            <TabsTrigger value="pipeline" className="h-7 text-xs gap-1.5 px-3">
              <GitBranch className="w-3.5 h-3.5" />
              Pipeline
            </TabsTrigger>
            <TabsTrigger value="blockly" className="h-7 text-xs gap-1.5 px-3">
              <Puzzle className="w-3.5 h-3.5" />
              Strategy Builder
            </TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="text-[10px] text-muted-foreground">
          {viewMode === "pipeline" 
            ? "Visual workflow canvas - connect nodes to build trading systems" 
            : "Blockly editor - build strategy logic with blocks"}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {viewMode === "pipeline" ? (
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          }>
            <PipelineCanvas />
          </Suspense>
        ) : (
          <BlocklyWorkspace
            runTour={runTour}
            onStartTour={handleStartTour}
            onTourComplete={handleTourComplete}
            onStepChange={handleStepChange}
            showAIPanelFromParent={showAIPanel}
            onAIPanelChange={setShowAIPanel}
            leverage={leverage}
            onLeverageChange={setLeverage}
            onXmlChange={handleXmlChange}
            onStrategyGenerated={handleStrategyGenerated}
            generatedStrategyId={generatedStrategyId}
            loadedTemplateId={loadedTemplateId}
            onTemplateLoaded={handleTemplateLoaded}
            onWorkspaceRef={setWorkspaceRefState}
          />
        )}
      </div>
    </div>
  );
};

export default Index;

