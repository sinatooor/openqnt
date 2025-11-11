import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { BlocksSidebar } from "@/components/BlocksSidebar";
import { Canvas } from "@/components/Canvas";
import { SettingsPanel } from "@/components/SettingsPanel";

const Index = () => {
  return (
    <DndProvider backend={HTML5Backend}>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        <BlocksSidebar />
        <Canvas />
        <SettingsPanel />
      </div>
    </DndProvider>
  );
};

export default Index;
