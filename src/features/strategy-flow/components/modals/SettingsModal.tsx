/**
 * SettingsModal - Modal for strategy flow settings
 */

import { memo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Palette, Grid3X3, Keyboard, Save } from 'lucide-react';
import { useStrategyFlowStore } from '../../store/strategyFlowStore';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SettingsModal = memo(({ open, onOpenChange }: SettingsModalProps) => {
  const { showGrid, toggleGrid } = useStrategyFlowStore();
  
  const [settings, setSettings] = useState({
    // Canvas Settings
    snapToGrid: true,
    gridSize: 16,
    showMinimap: true,
    animateEdges: true,
    
    // Visual Settings
    nodeWidth: 220,
    edgeType: 'smoothstep',
    
    // Behavior Settings
    autoSave: true,
    autoSaveInterval: 30,
    confirmDelete: true,
    
    // Keyboard Settings
    enableShortcuts: true,
  });

  const updateSetting = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    // Save settings to localStorage
    localStorage.setItem('strategy-flow-settings', JSON.stringify(settings));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] bg-[#1e1e1e] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-purple-400" />
            Strategy Flow Settings
          </DialogTitle>
          <DialogDescription className="text-white/60">
            Customize your strategy builder experience.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="canvas" className="mt-4">
          <TabsList className="bg-[#2a2a2a] border-white/10 w-full">
            <TabsTrigger value="canvas" className="flex-1 data-[state=active]:bg-white/10">
              <Grid3X3 className="w-4 h-4 mr-2" />
              Canvas
            </TabsTrigger>
            <TabsTrigger value="visual" className="flex-1 data-[state=active]:bg-white/10">
              <Palette className="w-4 h-4 mr-2" />
              Visual
            </TabsTrigger>
            <TabsTrigger value="keyboard" className="flex-1 data-[state=active]:bg-white/10">
              <Keyboard className="w-4 h-4 mr-2" />
              Shortcuts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="canvas" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white">Show Grid</Label>
                <p className="text-xs text-white/50">Display background grid dots</p>
              </div>
              <Switch 
                checked={showGrid} 
                onCheckedChange={toggleGrid}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white">Snap to Grid</Label>
                <p className="text-xs text-white/50">Align nodes to grid when dragging</p>
              </div>
              <Switch 
                checked={settings.snapToGrid} 
                onCheckedChange={(v) => updateSetting('snapToGrid', v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white">Grid Size</Label>
                <p className="text-xs text-white/50">Size of grid cells in pixels</p>
              </div>
              <Input
                type="number"
                value={settings.gridSize}
                onChange={(e) => updateSetting('gridSize', parseInt(e.target.value))}
                className="w-20 bg-[#2a2a2a] border-white/10"
                min={8}
                max={64}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white">Show Minimap</Label>
                <p className="text-xs text-white/50">Display overview map in corner</p>
              </div>
              <Switch 
                checked={settings.showMinimap} 
                onCheckedChange={(v) => updateSetting('showMinimap', v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white">Animate Connections</Label>
                <p className="text-xs text-white/50">Show flow animation on edges</p>
              </div>
              <Switch 
                checked={settings.animateEdges} 
                onCheckedChange={(v) => updateSetting('animateEdges', v)}
              />
            </div>
          </TabsContent>

          <TabsContent value="visual" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white">Node Width</Label>
                <p className="text-xs text-white/50">Default width of new nodes</p>
              </div>
              <Input
                type="number"
                value={settings.nodeWidth}
                onChange={(e) => updateSetting('nodeWidth', parseInt(e.target.value))}
                className="w-20 bg-[#2a2a2a] border-white/10"
                min={150}
                max={400}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white">Auto-save</Label>
                <p className="text-xs text-white/50">Automatically save your work</p>
              </div>
              <Switch 
                checked={settings.autoSave} 
                onCheckedChange={(v) => updateSetting('autoSave', v)}
              />
            </div>

            {settings.autoSave && (
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-white">Auto-save Interval</Label>
                  <p className="text-xs text-white/50">Seconds between saves</p>
                </div>
                <Input
                  type="number"
                  value={settings.autoSaveInterval}
                  onChange={(e) => updateSetting('autoSaveInterval', parseInt(e.target.value))}
                  className="w-20 bg-[#2a2a2a] border-white/10"
                  min={10}
                  max={300}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white">Confirm Delete</Label>
                <p className="text-xs text-white/50">Ask before deleting nodes</p>
              </div>
              <Switch 
                checked={settings.confirmDelete} 
                onCheckedChange={(v) => updateSetting('confirmDelete', v)}
              />
            </div>
          </TabsContent>

          <TabsContent value="keyboard" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-white">Enable Shortcuts</Label>
                <p className="text-xs text-white/50">Use keyboard shortcuts</p>
              </div>
              <Switch 
                checked={settings.enableShortcuts} 
                onCheckedChange={(v) => updateSetting('enableShortcuts', v)}
              />
            </div>

            <div className="mt-4 space-y-2">
              <Label className="text-white/70 text-sm">Keyboard Shortcuts</Label>
              <div className="bg-[#2a2a2a] rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/70">Delete Node</span>
                  <kbd className="px-2 py-0.5 bg-white/10 rounded text-white/80">Delete</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Duplicate Node</span>
                  <kbd className="px-2 py-0.5 bg-white/10 rounded text-white/80">Ctrl+D</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Undo</span>
                  <kbd className="px-2 py-0.5 bg-white/10 rounded text-white/80">Ctrl+Z</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Redo</span>
                  <kbd className="px-2 py-0.5 bg-white/10 rounded text-white/80">Ctrl+Y</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Pan Mode</span>
                  <kbd className="px-2 py-0.5 bg-white/10 rounded text-white/80">H</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Toggle Grid</span>
                  <kbd className="px-2 py-0.5 bg-white/10 rounded text-white/80">G</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Fit View</span>
                  <kbd className="px-2 py-0.5 bg-white/10 rounded text-white/80">Ctrl+1</kbd>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-6">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="border-white/10 text-white/70 hover:bg-white/10"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Settings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});

SettingsModal.displayName = 'SettingsModal';
