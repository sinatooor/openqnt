/**
 * Custom hook for handling workspace zoom operations
 */

import { MutableRefObject } from "react";
import * as Blockly from "blockly";

interface UseZoomHandlersProps {
  workspaceRef: MutableRefObject<Blockly.WorkspaceSvg | null>;
  setZoomLevel: (level: number) => void;
}

export const useZoomHandlers = ({
  workspaceRef,
  setZoomLevel,
}: UseZoomHandlersProps) => {
  const handleZoom = (direction: "in" | "out") => {
    if (!workspaceRef.current) return;
    const workspace = workspaceRef.current;
    const currentScale = workspace.getScale();
    const newScale =
      direction === "in" ? currentScale * 1.2 : currentScale / 1.2;
    workspace.setScale(newScale);
    setZoomLevel(Math.round(newScale * 100));
  };

  const handleCenterWorkspace = () => {
    if (!workspaceRef.current) return;
    const workspace = workspaceRef.current;
    workspace.scrollCenter();
    workspace.setScale(1);
    setZoomLevel(100);
  };

  return {
    handleZoom,
    handleCenterWorkspace,
  };
};
