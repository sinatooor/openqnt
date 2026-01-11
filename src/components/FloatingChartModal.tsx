
import { useState, useRef, useEffect, useCallback } from "react";
import { DraggableModal } from "./DraggableModal";
import { TradingViewAdvancedChart } from "./TradingViewAdvancedChart";
import { TradingViewMarketOverview } from "./TradingViewMarketOverview";
import { Model, Layout, IJsonModel, TabNode } from "flexlayout-react";
import "flexlayout-react/style/dark.css";

interface FloatingChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol?: string;
}

// FlexLayout model configuration for the Chart Tab
const defaultLayoutModel: IJsonModel = {
  global: {
    tabEnableClose: false,
    tabEnableRename: false,
    borderSize: 0,
    tabSetEnableMaximize: true,
    tabSetEnableDivide: true,
    splitterSize: 4,
    splitterExtra: 4,
  },
  borders: [],
  layout: {
    type: "row",
    weight: 100,
    children: [
      {
        type: "tabset",
        weight: 75,
        children: [
          {
            type: "tab",
            name: "Advanced Chart",
            component: "advancedChart",
          },
        ],
      },
      {
        type: "tabset",
        weight: 25,
        children: [
          {
            type: "tab",
            name: "Market Overview",
            component: "marketOverview",
          },
        ],
      },
    ],
  },
};

export const FloatingChartModal = ({
  isOpen,
  onClose,
  symbol = "NASDAQ:AAPL",
}: FloatingChartModalProps) => {
  const [currentSymbol, setCurrentSymbol] = useState(symbol);
  const modelRef = useRef<Model | null>(null);

  // Initialize model once
  useEffect(() => {
    if (!modelRef.current) {
      modelRef.current = Model.fromJson(defaultLayoutModel);
    }
  }, []);

  // Component factory for FlexLayout
  const factory = useCallback((node: TabNode) => {
    const component = node.getComponent();

    switch (component) {
      case "advancedChart":
        return (
          <div className="w-full h-full bg-[#0f0f0f] rounded-lg overflow-hidden relative">
            <TradingViewAdvancedChart
              symbol={currentSymbol}
              interval="D"
              theme="dark"
            />
          </div>
        );
      case "marketOverview":
        return (
          <div className="w-full h-full bg-[#0f0f0f] rounded-lg overflow-hidden relative">
            <TradingViewMarketOverview colorTheme="dark" />
          </div>
        );
      default:
        return <div className="p-4 text-muted-foreground">Unknown component: {component}</div>;
    }
  }, [currentSymbol]);

  if (!isOpen) return null;

  return (
    <DraggableModal
      isOpen={isOpen}
      onClose={onClose}
      title="Live Trading Dashboard"
      defaultWidth={1200}
      defaultHeight={800}
      minWidth={800}
      minHeight={600}
    >
      <div className="w-full h-full flex flex-col bg-background/95 p-1">
        {/* Custom FlexLayout styling */}
        <style>{`
                .flexlayout__layout {
                  --color-1: #0f0f0f;
                  --color-2: #1a1a1a;
                  --color-3: #2a2a2a;
                  --color-4: #3a3a3a;
                  --color-5: #4a4a4a;
                  --color-tabset-header-background: transparent;
                  --color-tabset-background: transparent;
                  --color-tab-selected-background: rgba(59, 130, 246, 0.15);
                  --color-tab-unselected-background: transparent;
                  --color-tab-selected: #fff;
                  --color-tab-unselected: #888;
                  --color-splitter: rgba(255, 255, 255, 0.1);
                  --color-splitter-drag: rgba(59, 130, 246, 0.5);
                  --color-drag-rect: rgba(59, 130, 246, 0.3);
                  --color-drag-rect-border: rgba(59, 130, 246, 0.8);
                  --font-size: 12px;
                  background: transparent !important;
                }
                .flexlayout__tabset {
                  background: rgba(15, 15, 15, 0.5) !important;
                  border-radius: 0px;
                  overflow: hidden;
                  border: none;
                }
                .flexlayout__tabset_header {
                  background: rgba(0, 0, 0, 0.3) !important;
                  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                }
                .flexlayout__tab {
                  background: transparent !important;
                }
                .flexlayout__tab_button {
                  padding: 4px 12px !important;
                  border-radius: 4px !important;
                  margin: 2px !important;
                  font-weight: 500;
                }
                .flexlayout__tab_button--selected {
                  background: rgba(59, 130, 246, 0.2) !important;
                }
                .flexlayout__splitter {
                  background: rgba(255, 255, 255, 0.05) !important;
                }
                .flexlayout__splitter:hover {
                  background: rgba(59, 130, 246, 0.3) !important;
                }
            `}</style>
        <div className="w-full h-full relative">
          {modelRef.current && (
            <Layout
              model={modelRef.current}
              factory={factory}
              realtimeResize={true}
            />
          )}
        </div>
      </div>
    </DraggableModal>
  );
};
