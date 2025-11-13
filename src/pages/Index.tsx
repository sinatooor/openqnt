import { BlocklyWorkspace } from "@/components/BlocklyWorkspace";
import { SettingsPanel } from "@/components/SettingsPanel";

const Index = () => {
  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Left Panel - Settings (hidden on mobile, shown on tablet+) */}
      <div className="hidden md:block">
        <SettingsPanel />
      </div>
      
      {/* Center Panel - Blockly Workspace (flexible, includes backtesting panel when shown) */}
      <BlocklyWorkspace />
    </div>
  );
};

export default Index;
