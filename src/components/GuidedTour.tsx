import { useEffect } from "react";
import React from "react";
import Joyride, { CallBackProps, STATUS, Step } from "react-joyride";
import { Button } from "@/components/ui";
import { Info } from "lucide-react";

interface GuidedTourProps {
  run: boolean;
  onComplete: () => void;
  onStepChange?: (stepIndex: number) => void;
}

export const GuidedTour = ({ run, onComplete, onStepChange }: GuidedTourProps) => {
  const steps: Step[] = [
    {
      target: ".ai-panel-trigger",
      content:
        "Welcome! This is your AI Strategy Generator. You can click it now to open it, or press 'Next' and we'll open it for you.",
      disableBeacon: true,
      placement: "bottom",
    },
    {
      target: ".blockly-workspace",
      content:
        "The AI panel is now open! This is your visual programming workspace. Drag and drop blocks from the left sidebar to build your trading strategy. You can also drag blocks into the AI chat to ask questions about them!",
      placement: "center",
    },
    {
      target: ".backtest-trigger",
      content:
        "Once you've built a strategy, click here to backtest it. See how your strategy would have performed with historical data before going live.",
      placement: "bottom",
    },
    {
      target: ".run-strategy-trigger",
      content:
        "Ready to execute? Click here to run your strategy. This will turn your blocks into code and start your trading bot.",
      placement: "bottom",
    },
    {
      target: ".save-workspace-trigger",
      content:
        "Don't forget to save your work! You can save and load your strategies anytime. Happy trading! 🚀",
      placement: "bottom",
    },
  ];

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status, index, action, type } = data;

    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status as any)) {
      onComplete();
    }

    // Trigger step change callback when moving to next step
    if (type === "step:after" && onStepChange) {
      onStepChange(index);
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      disableOverlayClose={true}
      disableScrolling={true}
      spotlightClicks={true}
      disableCloseOnEsc={false}
      styles={{
        options: {
          primaryColor: "#ec4899",
          textColor: "hsl(var(--foreground))",
          backgroundColor: "hsl(var(--background))",
          overlayColor: "rgba(0, 0, 0, 0.7)",
          arrowColor: "hsl(var(--background))",
          zIndex: 10001,
        },
        tooltip: {
          borderRadius: "8px",
          padding: "20px",
        },
        tooltipContainer: {
          textAlign: "left",
        },
        buttonNext: {
          backgroundColor: "#ec4899",
          borderRadius: "6px",
          padding: "8px 16px",
          fontSize: "14px",
        },
        buttonBack: {
          color: "hsl(var(--muted-foreground))",
          marginRight: "8px",
        },
        buttonSkip: {
          color: "hsl(var(--muted-foreground))",
        },
      }}
      locale={{
        back: "Back",
        close: "Close",
        last: "Finish",
        next: "Next",
        skip: "Skip Tour",
      }}
    />
  );
};

interface TourTriggerButtonProps {
  onClick: () => void;
  className?: string;
}

export const TourTriggerButton = React.forwardRef<HTMLButtonElement, TourTriggerButtonProps>(({ onClick, className }, ref) => {
  return (
    <Button
      ref={ref}
      onClick={onClick}
      variant="outline"
      size="icon"
      className={`tour-trigger-btn ${className || ""}`}
      title="Start Guided Tour"
    >
      <Info className="w-4 h-4" />
    </Button>
  );
});
TourTriggerButton.displayName = "TourTriggerButton";
