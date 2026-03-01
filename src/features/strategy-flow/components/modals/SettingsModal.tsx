/**
 * SettingsModal - Modal for strategy flow settings
 */

import { memo, useState, useEffect } from 'react';
import { WindowModal } from './WindowModal';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Palette, Grid3X3, Keyboard, Save, Eye, EyeOff, Brain, CheckCircle2 } from 'lucide-react';
import { useStrategyFlowStore } from '../../store/strategyFlowStore';
import { toast } from 'sonner';
import { LLM_MODELS, LLMModelProvider } from '../../types';

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Type for LLM API keys storage
interface LLMApiKeys {
  openai: string;
  anthropic: string;
  google: string;
}

// Load LLM API keys from localStorage
const loadLLMApiKeys = (): LLMApiKeys => {
  try {
    const stored = localStorage.getItem('llm-api-keys');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {
    // Ignore parse errors
  }
  return { openai: '', anthropic: '', google: '' };
};

// Save LLM API keys to localStorage
const saveLLMApiKeys = (keys: LLMApiKeys) => {
  localStorage.setItem('llm-api-keys', JSON.stringify(keys));
};

// Export for use in LLM node execution
export const getLLMApiKey = (provider: LLMModelProvider): string => {
  const keys = loadLLMApiKeys();
  return keys[provider] || '';
};

export const SettingsModal = memo(({ open, onOpenChange }: SettingsModalProps) => {
  const { showGrid, toggleGrid } = useStrategyFlowStore();
  
  // LLM API Keys visibility states
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState(false);
  const [showGoogleKey, setShowGoogleKey] = useState(false);
  
  // LLM API Keys
  const [llmApiKeys, setLlmApiKeys] = useState<LLMApiKeys>(loadLLMApiKeys());

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
  
  const updateLLMApiKey = (provider: LLMModelProvider, value: string) => {
    setLlmApiKeys(prev => ({ ...prev, [provider]: value }));
  };

  const handleSave = () => {
    // Save settings to localStorage
    localStorage.setItem('strategy-flow-settings', JSON.stringify(settings));
    // Save LLM API keys
    saveLLMApiKeys(llmApiKeys);
    toast.success('Settings saved');
    onOpenChange(false);
  };
  
  // Get which providers have keys configured
  const configuredProviders = Object.entries(llmApiKeys)
    .filter(([_, key]) => key.length > 0)
    .map(([provider]) => provider as LLMModelProvider);

  return (
    <WindowModal
      open={open}
      onOpenChange={onOpenChange}
      title="Strategy Flow Settings"
      icon={<Settings className="w-5 h-5" />}
      defaultWidth={550}
      defaultHeight={650}
      minWidth={400}
      minHeight={400}
    >
      <div className="p-6">
        <p className="text-sm text-muted-foreground mb-4">
          Customize your strategy builder experience.
        </p>

        <Tabs defaultValue="canvas" className="">
          <TabsList className="bg-secondary border-border w-full grid grid-cols-4">
            <TabsTrigger value="canvas" className="data-[state=active]:bg-accent">
              <Grid3X3 className="w-4 h-4 mr-1" />
              Canvas
            </TabsTrigger>
            <TabsTrigger value="visual" className="data-[state=active]:bg-accent">
              <Palette className="w-4 h-4 mr-1" />
              Visual
            </TabsTrigger>
            <TabsTrigger value="keyboard" className="data-[state=active]:bg-accent">
              <Keyboard className="w-4 h-4 mr-1" />
              Keys
            </TabsTrigger>
            <TabsTrigger value="llm" className="data-[state=active]:bg-accent">
              <Brain className="w-4 h-4 mr-1" />
              LLM
            </TabsTrigger>
          </TabsList>

          <TabsContent value="canvas" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-foreground">Show Grid</Label>
                <p className="text-xs text-muted-foreground">Display background grid dots</p>
              </div>
              <Switch
                checked={showGrid}
                onCheckedChange={toggleGrid}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-foreground">Snap to Grid</Label>
                <p className="text-xs text-muted-foreground">Align nodes to grid when dragging</p>
              </div>
              <Switch
                checked={settings.snapToGrid}
                onCheckedChange={(v) => updateSetting('snapToGrid', v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-foreground">Grid Size</Label>
                <p className="text-xs text-muted-foreground">Size of grid cells in pixels</p>
              </div>
              <Input
                type="number"
                value={settings.gridSize}
                onChange={(e) => updateSetting('gridSize', parseInt(e.target.value))}
                className="w-20 bg-secondary border-border"
                min={8}
                max={64}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-foreground">Show Minimap</Label>
                <p className="text-xs text-muted-foreground">Display overview map in corner</p>
              </div>
              <Switch
                checked={settings.showMinimap}
                onCheckedChange={(v) => updateSetting('showMinimap', v)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-foreground">Animate Connections</Label>
                <p className="text-xs text-muted-foreground">Show flow animation on edges</p>
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
                <Label className="text-foreground">Node Width</Label>
                <p className="text-xs text-muted-foreground">Default width of new nodes</p>
              </div>
              <Input
                type="number"
                value={settings.nodeWidth}
                onChange={(e) => updateSetting('nodeWidth', parseInt(e.target.value))}
                className="w-20 bg-secondary border-border"
                min={150}
                max={400}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-foreground">Auto-save</Label>
                <p className="text-xs text-muted-foreground">Automatically save your work</p>
              </div>
              <Switch
                checked={settings.autoSave}
                onCheckedChange={(v) => updateSetting('autoSave', v)}
              />
            </div>

            {settings.autoSave && (
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-foreground">Auto-save Interval</Label>
                  <p className="text-xs text-muted-foreground">Seconds between saves</p>
                </div>
                <Input
                  type="number"
                  value={settings.autoSaveInterval}
                  onChange={(e) => updateSetting('autoSaveInterval', parseInt(e.target.value))}
                  className="w-20 bg-secondary border-border"
                  min={10}
                  max={300}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <Label className="text-foreground">Confirm Delete</Label>
                <p className="text-xs text-muted-foreground">Ask before deleting nodes</p>
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
                <Label className="text-foreground">Enable Shortcuts</Label>
                <p className="text-xs text-muted-foreground">Use keyboard shortcuts</p>
              </div>
              <Switch
                checked={settings.enableShortcuts}
                onCheckedChange={(v) => updateSetting('enableShortcuts', v)}
              />
            </div>

            <div className="mt-4 space-y-2">
              <Label className="text-muted-foreground text-sm">Keyboard Shortcuts</Label>
              <div className="bg-secondary rounded-lg p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delete Node</span>
                  <kbd className="px-2 py-0.5 bg-accent rounded text-foreground/80">Delete</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duplicate Node</span>
                  <kbd className="px-2 py-0.5 bg-accent rounded text-foreground/80">Ctrl+D</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Undo</span>
                  <kbd className="px-2 py-0.5 bg-accent rounded text-foreground/80">Ctrl+Z</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Redo</span>
                  <kbd className="px-2 py-0.5 bg-accent rounded text-foreground/80">Ctrl+Y</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pan Mode</span>
                  <kbd className="px-2 py-0.5 bg-accent rounded text-foreground/80">H</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Toggle Grid</span>
                  <kbd className="px-2 py-0.5 bg-accent rounded text-foreground/80">G</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Fit View</span>
                  <kbd className="px-2 py-0.5 bg-accent rounded text-foreground/80">Ctrl+1</kbd>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="llm" className="space-y-4 mt-4">
            {/* Info Banner */}
            <div className="flex items-start gap-2 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
              <Brain className="w-4 h-4 text-purple-400 mt-0.5 shrink-0" />
              <div className="text-xs text-purple-200">
                <p className="font-medium">LLM API Keys</p>
                <p className="text-purple-200/80 mt-1">
                  Configure API keys for AI-powered nodes. Keys are stored locally and never sent to our servers.
                </p>
              </div>
            </div>

            {/* Configured Providers Status */}
            {configuredProviders.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-green-400">
                <CheckCircle2 className="w-3 h-3" />
                <span>Configured: {configuredProviders.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(', ')}</span>
              </div>
            )}

            {/* OpenAI API Key */}
            <div className="space-y-2">
              <Label className="text-foreground">OpenAI API Key</Label>
              <p className="text-xs text-muted-foreground">For GPT-4o, GPT-4 Turbo models</p>
              <div className="relative">
                <Input
                  type={showOpenAIKey ? 'text' : 'password'}
                  value={llmApiKeys.openai}
                  onChange={(e) => updateLLMApiKey('openai', e.target.value)}
                  placeholder="sk-..."
                  className="pr-10 bg-secondary border-border font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  {showOpenAIKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Anthropic API Key */}
            <div className="space-y-2">
              <Label className="text-foreground">Anthropic API Key</Label>
              <p className="text-xs text-muted-foreground">For Claude 3 Opus, Sonnet, Haiku models</p>
              <div className="relative">
                <Input
                  type={showAnthropicKey ? 'text' : 'password'}
                  value={llmApiKeys.anthropic}
                  onChange={(e) => updateLLMApiKey('anthropic', e.target.value)}
                  placeholder="sk-ant-..."
                  className="pr-10 bg-secondary border-border font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowAnthropicKey(!showAnthropicKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  {showAnthropicKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Google API Key */}
            <div className="space-y-2">
              <Label className="text-foreground">Google AI API Key</Label>
              <p className="text-xs text-muted-foreground">For Gemini Pro models</p>
              <div className="relative">
                <Input
                  type={showGoogleKey ? 'text' : 'password'}
                  value={llmApiKeys.google}
                  onChange={(e) => updateLLMApiKey('google', e.target.value)}
                  placeholder="AIza..."
                  className="pr-10 bg-secondary border-border font-mono text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowGoogleKey(!showGoogleKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  {showGoogleKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Available Models */}
            <div className="mt-4 space-y-2">
              <Label className="text-muted-foreground text-sm">Available Models</Label>
              <div className="bg-secondary rounded-lg p-3 space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  {LLM_MODELS.map((model) => {
                    const hasKey = llmApiKeys[model.provider].length > 0;
                    return (
                      <div 
                        key={model.id} 
                        className={`flex items-center justify-between px-2 py-1 rounded ${hasKey ? 'bg-green-500/10' : 'bg-white/5'}`}
                      >
                        <span className={hasKey ? 'text-foreground' : 'text-muted-foreground'}>{model.label}</span>
                        {hasKey ? (
                          <CheckCircle2 className="w-3 h-3 text-green-400" />
                        ) : (
                          <span className="text-[10px] text-muted-foreground">No key</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Info about getting API keys */}
            <div className="text-xs text-muted-foreground p-3 bg-secondary rounded-lg">
              <p className="font-medium mb-1">How to get API keys:</p>
              <ul className="list-disc ml-4 space-y-1">
                <li>OpenAI: <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">platform.openai.com/api-keys</a></li>
                <li>Anthropic: <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">console.anthropic.com</a></li>
                <li>Google AI: <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">makersuite.google.com</a></li>
              </ul>
            </div>
          </TabsContent>

        </Tabs>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border/50">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-border text-muted-foreground hover:bg-accent"
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
        </div>
      </div>
    </WindowModal>
  );
});

SettingsModal.displayName = 'SettingsModal';
