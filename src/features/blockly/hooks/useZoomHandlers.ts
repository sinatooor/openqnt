/**
 * Custom hook for zoom operation handlers
 */

import * as Blockly from "blockly";

interface UseZoomHandlersProps {
  workspaceRef: React.RefObject<Blockly.WorkspaceSvg | null>;
  setZoomLevel: (level: number) => void;
}

export const useZoomHandlers = ({
  workspaceRef,
  setZoomLevel,
}: UseZoomHandlersProps) => {
  const handleZoom = (direction: "in" | "out" | "reset" | number) => {
    if (!workspaceRef.current) return;
    const workspace = workspaceRef.current;
    const currentZoom = workspace.scale;

    if (typeof direction === "number") {
      workspace.setScale(direction / 100);
    } else if (direction === "in") {
      workspace.setScale(currentZoom * 1.2);
    } else if (direction === "out") {
      workspace.setScale(currentZoom / 1.2);
    } else if (direction === "reset") {
      workspace.setScale(1.0);
      workspace.scrollCenter();
    }

    const newZoom = workspace.scale;
    setZoomLevel(Math.round(newZoom * 100));
  };

  return {
    handleZoom,
  };
};
