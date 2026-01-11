
import { DraggableModal } from "./DraggableModal";
import { ScreenerPanel } from "./ScreenerPanel";

interface ScreenerModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const ScreenerModal = ({ isOpen, onClose }: ScreenerModalProps) => {
    return (
        <DraggableModal
            isOpen={isOpen}
            onClose={onClose}
            title="Market Screener Pro"
            defaultWidth={1000}
            defaultHeight={800}
            minWidth={800}
            minHeight={600}
        >
            <div className="w-full h-full bg-background/95">
                <ScreenerPanel />
            </div>
        </DraggableModal>
    );
};
