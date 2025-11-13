import { BlocklyWorkspace } from "@/components/BlocklyWorkspace";
import { SettingsPanel } from "@/components/SettingsPanel";

const Index = () => {
  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <BlocklyWorkspace />
      <SettingsPanel />
    </div>
  );
};

export default Index;
