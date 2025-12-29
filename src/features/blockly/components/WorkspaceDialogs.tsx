import { StrategyTemplatesDialog } from "@/components/StrategyTemplatesDialog";
import { FloatingChartModal } from "@/components/FloatingChartModal";
import { GuidedTour } from "@/components/GuidedTour";
import { DevLogPanel, LogEntry } from "@/components/DevLogPanel";
import { BlockSearchDialog } from "@/components/BlockSearchDialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { IndicatorSettingsModal } from "@/components/IndicatorSettingsModal";
import { StrategyTemplate } from "@/features/templates/strategyTemplates";

interface WorkspaceDialogsProps {
    showTemplates: boolean;
    setShowTemplates: (show: boolean) => void;
    handleLoadTemplate: (template: StrategyTemplate) => void;
    showFloatingChart: boolean;
    setShowFloatingChart: (show: boolean) => void;
    showDevLogs: boolean;
    devLogs: LogEntry[];
    handleClearLogs: () => void;
    handleCloseLogs: () => void;
    showConfirmDialog: boolean;
    setShowConfirmDialog: (show: boolean) => void;
    handleConfirmAdd: () => void;
    handleCancelAdd: () => void;
    runTour: boolean;
    handleTourComplete: () => void;
    onStepChange?: (step: number) => void;
    showIndicatorSettings: boolean;
    setShowIndicatorSettings: (show: boolean) => void;
    currentIndicatorName: string;
    currentIndicatorParams: Record<string, number>;
    handleSaveIndicatorSettings: (params: Record<string, number>) => void;
    showSearch: boolean;
    setShowSearch: (show: boolean) => void;
    handleAddBlock: (type: string) => void;
}

export const WorkspaceDialogs = ({
    showTemplates,
    setShowTemplates,
    handleLoadTemplate,
    showFloatingChart,
    setShowFloatingChart,
    showDevLogs,
    devLogs,
    handleClearLogs,
    handleCloseLogs,
    showConfirmDialog,
    setShowConfirmDialog,
    handleConfirmAdd,
    handleCancelAdd,
    runTour,
    handleTourComplete,
    onStepChange,
    showIndicatorSettings,
    setShowIndicatorSettings,
    currentIndicatorName,
    currentIndicatorParams,
    handleSaveIndicatorSettings,
    showSearch,
    setShowSearch,
    handleAddBlock,
}: WorkspaceDialogsProps) => {
    return (
        <>
            <StrategyTemplatesDialog open={showTemplates} onOpenChange={setShowTemplates} onLoadTemplate={handleLoadTemplate} />
            <FloatingChartModal isOpen={showFloatingChart} onClose={() => setShowFloatingChart(false)} symbol="BTC/USDT" interval="1D" />
            {showDevLogs && (
                <DevLogPanel
                    logs={devLogs}
                    onClear={handleClearLogs}
                    onClose={handleCloseLogs}
                />
            )}
            <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Add AI-Generated Blocks?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Your workspace already contains blocks. Do you want to add the AI-generated strategy blocks to your existing workspace?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={handleCancelAdd}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmAdd}>Add Blocks</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <GuidedTour
                run={runTour}
                onComplete={handleTourComplete}
                onStepChange={onStepChange}
            />
            <IndicatorSettingsModal
                open={showIndicatorSettings}
                onOpenChange={setShowIndicatorSettings}
                indicatorName={currentIndicatorName}
                currentParams={currentIndicatorParams}
                onSave={handleSaveIndicatorSettings}
            />
            <BlockSearchDialog
                open={showSearch}
                onOpenChange={setShowSearch}
                onSelectBlock={handleAddBlock}
            />
        </>
    );
};
