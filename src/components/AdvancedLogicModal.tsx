import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { SubLogicWorkspace } from "./SubLogicWorkspace";
import { useState, useEffect } from "react";
import { Settings2, Save, X } from "lucide-react";

interface AdvancedLogicModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialXml?: string;
    indicatorType?: string;
    onSave: (xml: string) => void;
}

export const AdvancedLogicModal = ({
    open,
    onOpenChange,
    initialXml,
    indicatorType,
    onSave
}: AdvancedLogicModalProps) => {
    const [currentXml, setCurrentXml] = useState<string>(initialXml || "");

    // Reset XML when modal opens with new initialXml
    useEffect(() => {
        if (open) {
            setCurrentXml(initialXml || "");
        }
    }, [open, initialXml]);

    const handleSave = () => {
        onSave(currentXml);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings2 className="w-5 h-5" />
                        Advanced Indicator Logic: {indicatorType?.replace('ta_', '').toUpperCase()}
                    </DialogTitle>
                    <DialogDescription>
                        Define custom boolean logic for this indicator. The result (1 or 0) will be returned by the block.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 min-h-0 border rounded-md overflow-hidden bg-background">
                    <SubLogicWorkspace
                        initialXml={initialXml}
                        onXmlChange={setCurrentXml}
                        indicatorType={indicatorType}
                    />
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        <X className="w-4 h-4 mr-2" />
                        Cancel
                    </Button>
                    <Button onClick={handleSave}>
                        <Save className="w-4 h-4 mr-2" />
                        Save Logic
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
