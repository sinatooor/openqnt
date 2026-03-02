/**
 * CodeViewPanel - Panel to display generated code (Python, MQL5, Nautilus, JSON, Pine Script)
 * Equivalent to Blockly's CodeViewPanel
 */

import { memo, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  Code2,
  Copy,
  Check,
  Download,
  X,
  Wand2,
  Hash,
  FileCode,
  FileJson,
  AlertCircle,
  LineChart,
} from 'lucide-react';
import { toast } from 'sonner';
import { useStrategyFlowStore } from '../store/strategyFlowStore';
import {
  generatePythonCode,
  generateMQL5Code,
  generateNautilusCode,
  generateJSON,
  generatePineScriptCode,
} from '../generators';

interface CodeViewPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type CodeLanguage = 'python' | 'mql5' | 'nautilus' | 'json' | 'pinescript';

export const CodeViewPanel = memo(({ open, onOpenChange }: CodeViewPanelProps) => {
  const [copied, setCopied] = useState(false);
  const [showLineNumbers, setShowLineNumbers] = useState(true);

  const { nodes, edges, strategyName, strategyDescription, pineScriptMode } = useStrategyFlowStore();
  const [activeTab, setActiveTab] = useState<CodeLanguage>(pineScriptMode ? 'pinescript' : 'python');

  // Generate code for each language
  const generatedCode = useMemo(() => {
    const options = { leverage: 1 };

    // In Pine Script mode, only generate Pine Script
    if (pineScriptMode) {
      const pineResult = generatePineScriptCode(nodes, edges, strategyName, strategyDescription);
      return {
        pinescript: {
          code: pineResult.code,
          errors: pineResult.errors,
          warnings: pineResult.warnings,
        },
        python: { code: '', errors: [], warnings: [] },
        mql5: { code: '', errors: [], warnings: [] },
        nautilus: { code: '', errors: [], warnings: [] },
        json: { code: '', errors: [], warnings: [] },
      };
    }

    return {
      python: generatePythonCode(nodes, edges, options),
      mql5: generateMQL5Code(nodes, edges, options),
      nautilus: generateNautilusCode(nodes, edges, options),
      json: {
        code: generateJSON(nodes, edges, { name: strategyName, description: strategyDescription }),
        language: 'json' as const,
        errors: [],
        warnings: [],
      },
      pinescript: { code: '', errors: [], warnings: [] },
    };
  }, [nodes, edges, strategyName, strategyDescription, pineScriptMode]);

  const currentCode = generatedCode[activeTab];
  const hasErrors = currentCode.errors.length > 0;
  const hasWarnings = currentCode.warnings.length > 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentCode.code);
      setCopied(true);
      toast.success('Code copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      toast.error('Failed to copy code');
    }
  };

  const handleDownload = () => {
    const extensions: Record<CodeLanguage, string> = {
      python: 'py',
      mql5: 'mq5',
      nautilus: 'py',
      json: 'json',
      pinescript: 'pine',
    };

    const blob = new Blob([currentCode.code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${strategyName.replace(/\s+/g, '_')}.${extensions[activeTab]}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Code downloaded');
  };

  const renderCodeWithLineNumbers = (code: string) => {
    const lines = code.split('\n');
    return (
      <div className="flex">
        {showLineNumbers && (
          <div className="select-none pr-4 text-right text-white/30 border-r border-white/10 mr-4">
            {lines.map((_, i) => (
              <div key={i} className="leading-6">{i + 1}</div>
            ))}
          </div>
        )}
        <pre className="flex-1 overflow-x-auto">
          <code className="text-white/80">{code}</code>
        </pre>
      </div>
    );
  };

  const getStats = () => {
    const lines = currentCode.code.split('\n').length;
    const chars = currentCode.code.length;
    return { lines, chars };
  };

  const stats = getStats();

  if (!open) return null;

  return (
    <div className="fixed right-0 top-0 bottom-0 w-[450px] bg-[#1e1e1e] border-l border-white/10 flex flex-col z-40 shadow-2xl">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Code2 className="w-5 h-5 text-purple-400" />
            <h2 className="font-semibold text-white">Generated Code</h2>
          </div>
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white/70 hover:text-white"
                  onClick={() => setShowLineNumbers(!showLineNumbers)}
                >
                  <Hash className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Toggle line numbers</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white/70 hover:text-white"
                  onClick={handleCopy}
                >
                  {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy to clipboard</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white/70 hover:text-white"
                  onClick={handleDownload}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download file</TooltipContent>
            </Tooltip>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white/70 hover:text-white hover:bg-red-500/20"
              onClick={() => onOpenChange(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Language Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as CodeLanguage)}>
          <TabsList className="w-full bg-[#2a2a2a] border-white/10">
            {pineScriptMode ? (
              <TabsTrigger value="pinescript" className="flex-1 data-[state=active]:bg-[#2962FF]/30 data-[state=active]:text-[#2962FF]">
                <LineChart className="w-3.5 h-3.5 mr-1.5" />
                Pine Script
              </TabsTrigger>
            ) : (
              <>
                <TabsTrigger value="python" className="flex-1 data-[state=active]:bg-white/10">
                  <FileCode className="w-3.5 h-3.5 mr-1.5" />
                  Python
                </TabsTrigger>
                <TabsTrigger value="mql5" className="flex-1 data-[state=active]:bg-white/10">
                  <FileCode className="w-3.5 h-3.5 mr-1.5" />
                  MQL5
                </TabsTrigger>
                <TabsTrigger value="nautilus" className="flex-1 data-[state=active]:bg-white/10">
                  <FileCode className="w-3.5 h-3.5 mr-1.5" />
                  Nautilus
                </TabsTrigger>
                <TabsTrigger value="json" className="flex-1 data-[state=active]:bg-white/10">
                  <FileJson className="w-3.5 h-3.5 mr-1.5" />
                  JSON
                </TabsTrigger>
              </>
            )}
          </TabsList>
        </Tabs>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-3 text-xs text-white/50">
          <span>{stats.lines} lines</span>
          <span>{stats.chars} chars</span>
          {hasErrors && (
            <span className="text-red-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {currentCode.errors.length} errors
            </span>
          )}
          {hasWarnings && (
            <span className="text-yellow-400 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {currentCode.warnings.length} warnings
            </span>
          )}
        </div>
      </div>

      {/* Errors/Warnings */}
      {(hasErrors || hasWarnings) && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20">
          {currentCode.errors.map((err, i) => (
            <div key={i} className="text-red-400 text-xs">{err}</div>
          ))}
          {currentCode.warnings.map((warn, i) => (
            <div key={i} className="text-yellow-400 text-xs">{warn}</div>
          ))}
        </div>
      )}

      {/* Code Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 font-mono text-xs leading-6">
          {renderCodeWithLineNumbers(currentCode.code)}
        </div>
      </ScrollArea>
    </div>
  );
});

CodeViewPanel.displayName = 'CodeViewPanel';
