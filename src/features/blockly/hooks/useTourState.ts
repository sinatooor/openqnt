/**
 * Custom hook for managing tour state
 */

import { useState, useEffect } from "react";

interface UseTourStateProps {
  runTour?: boolean;
  onTourComplete?: () => void;
}

export const useTourState = ({
  runTour: runTourProp,
  onTourComplete: onTourCompleteProp,
}: UseTourStateProps = {}) => {
  const [runTour, setRunTour] = useState(runTourProp || false);

  // Sync with prop changes
  useEffect(() => {
    if (runTourProp !== undefined) {
      setRunTour(runTourProp);
    }
  }, [runTourProp]);

  const handleTourComplete = () => {
    setRunTour(false);
    if (onTourCompleteProp) {
      onTourCompleteProp();
    } else {
      localStorage.setItem("hasSeenGuidedTour", "true");
    }
  };

  const handleStartTour = () => {
    setRunTour(true);
  };

  return {
    runTour,
    setRunTour,
    handleTourComplete,
    handleStartTour,
  };
};
