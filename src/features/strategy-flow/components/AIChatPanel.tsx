/**
 * AIChatPanel - AI-powered strategy builder for Strategy Flow
 * Full-height slider panel matching CodeViewPanel dimensions
 * Features: Generate/Chat/Code modes, Pine Script generation, code-based node creation
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Loader2,
  Send,
  Sparkles,
  MessageSquare,
  Blocks,
  X,
  Eye,
  Wrench,
  Copy,
  Check,
  Download,
  FileCode,
  LineChart,
  Terminal,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { useStrategyFlowStore } from '../store/strategyFlowStore';
import {
  generatePythonCode,
  generateMQL5Code,
  generateNautilusCode,
  generatePineScriptCode,
} from '../generators';
import type { StrategyFlowNode, StrategyFlowEdge } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  nodes?: StrategyFlowNode[];
  edges?: StrategyFlowEdge[];
  error?: boolean;
  codeBlock?: {
    language: string;
    code: string;
  };
}

interface GenerationProgress {
  step: number;
  totalSteps: number;
  message: string;
  phase: string;
}

interface AIChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type PanelMode = 'generate' | 'chat' | 'code';
type CodeLanguage = 'python' | 'mql5' | 'pinescript' | 'nautilus';

const EXAMPLE_PROMPTS = {
  generate: [
    '"RSI oversold buy strategy"',
    '"SMA crossover with 10 and 50 periods"',
    '"MACD signal line crossover"',
    '"Bollinger band breakout"',
  ],
  chat: [
    '"What is RSI?"',
    '"How do crossovers work?"',
    '"Explain my current strategy"',
  ],
  code: [
    '"Generate Pine Script for RSI strategy"',
    '"Create a MACD crossover Pine Script"',
    '"Write Python backtest for my strategy"',
    '"Convert my nodes to Pine Script v5"',
  ],
};

export const AIChatPanel = ({ open, onOpenChange }: AIChatPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>('generate');
  const [genMode, setGenMode] = useState<'fast' | 'slow' | 'tool-calling'>('fast');
  const [codeLanguage, setCodeLanguage] = useState<CodeLanguage>('pinescript');
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { nodes, edges, setNodes, setEdges, strategyName, strategyDescription, rightPanelWidth } =
    useStrategyFlowStore();

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Generate code from current nodes for code mode
  const currentCode = useMemo(() => {
    if (panelMode !== 'code' || nodes.length === 0) return null;

    try {
      switch (codeLanguage) {
        case 'pinescript': {
          const result = generatePineScriptCode(nodes, edges, strategyName, strategyDescription);
          return { code: result.code, errors: result.errors, warnings: result.warnings };
        }
        case 'python': {
          const result = generatePythonCode(nodes, edges, { leverage: 1 });
          return { code: result.code, errors: result.errors, warnings: result.warnings };
        }
        case 'mql5': {
          const result = generateMQL5Code(nodes, edges, { leverage: 1 });
          return { code: result.code, errors: result.errors, warnings: result.warnings };
        }
        case 'nautilus': {
          const result = generateNautilusCode(nodes, edges, { leverage: 1 });
          return { code: result.code, errors: result.errors, warnings: result.warnings };
        }
        default:
          return null;
      }
    } catch {
      return { code: '', errors: ['Failed to generate code'], warnings: [] };
    }
  }, [nodes, edges, codeLanguage, panelMode, strategyName, strategyDescription]);

  // Simulate generation progress
  const simulateProgress = useCallback(() => {
    const steps = genMode === 'slow' ? 5 : genMode === 'tool-calling' ? 6 : 4;
    const phases =
      genMode === 'slow'
        ? ['Analyzing', 'Building nodes', 'Connecting edges', 'Validating', 'Optimizing']
        : genMode === 'tool-calling'
          ? ['Planning', 'Adding indicators', 'Adding conditions', 'Adding actions', 'Connecting nodes', 'Finishing']
          : ['Analyzing', 'Building nodes', 'Connecting edges', 'Finalizing'];

    let step = 1;
    const interval = setInterval(
      () => {
        if (step <= steps) {
          setGenerationProgress({
            step,
            totalSteps: steps,
            message: phases[step - 1],
            phase: phases[step - 1],
          });
          step++;
        } else {
          clearInterval(interval);
        }
      },
      genMode === 'slow' ? 3000 : genMode === 'tool-calling' ? 2000 : 1500
    );

    return () => clearInterval(interval);
  }, [genMode]);

  // Add generated nodes to canvas
  const addNodesToCanvas = useCallback(
    (newNodes: StrategyFlowNode[], newEdges: StrategyFlowEdge[], replace: boolean = false) => {
      if (replace) {
        setNodes(newNodes);
        setEdges(newEdges);
        toast.success(`Replaced canvas with ${newNodes.length} nodes`);
      } else {
        const existingNodes = useStrategyFlowStore.getState().nodes;
        const existingEdges = useStrategyFlowStore.getState().edges;

        const maxX = existingNodes.reduce((max, n) => Math.max(max, n.position.x), 0);
        const offsetX = maxX > 0 ? maxX + 300 : 0;

        const offsetNodes = newNodes.map((node) => ({
          ...node,
          id: `${node.id}-${Date.now()}`,
          position: {
            x: node.position.x + offsetX,
            y: node.position.y,
          },
        }));

        const idMap = new Map(newNodes.map((n, i) => [n.id, offsetNodes[i].id]));
        const offsetEdges = newEdges.map((edge) => ({
          ...edge,
          id: `${edge.id}-${Date.now()}`,
          source: idMap.get(edge.source) || edge.source,
          target: idMap.get(edge.target) || edge.target,
        }));

        setNodes([...existingNodes, ...offsetNodes]);
        setEdges([...existingEdges, ...offsetEdges]);
        toast.success(`Added ${newNodes.length} nodes to canvas`);
      }
    },
    [setNodes, setEdges]
  );

  // Copy code to clipboard
  const handleCopyCode = async (code: string, id?: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(id || 'main');
      toast.success('Code copied to clipboard');
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error('Failed to copy code');
    }
  };

  // Download code
  const handleDownloadCode = (code: string, lang: CodeLanguage) => {
    const extensions: Record<CodeLanguage, string> = {
      python: 'py',
      mql5: 'mq5',
      pinescript: 'pine',
      nautilus: 'py',
    };
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${strategyName.replace(/\s+/g, '_')}.${extensions[lang]}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Code downloaded');
  };

  // Handle send message
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setGenerationProgress(null);

    try {
      if (panelMode === 'generate') {
        const cleanup = simulateProgress();

        const response = await fetch(`${backendUrl}/api/strategy-flow/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: input,
            currentNodes: nodes.length > 0 ? nodes : null,
            currentEdges: edges.length > 0 ? edges : null,
            mode: genMode,
          }),
        });

        cleanup();
        setGenerationProgress(null);

        if (!response.ok) throw new Error(`API error: ${response.status}`);

        const data = await response.json();

        if (data.success && data.nodes?.length > 0) {
          const modeLabel = data.generationMode === 'tool-calling' ? ' via tool calling' : '';
          const assistantMessage: Message = {
            role: 'assistant',
            content:
              (data.message || `Generated strategy with ${data.nodes.length} nodes.`) +
              (modeLabel ? `\n\n*Built${modeLabel}.*` : '') +
              (data.wasRationalized ? '\n\n*Strategy was optimized for better logic.*' : '') +
              (data.autoFixed ? '\n\n*Some parameters were auto-corrected.*' : ''),
            nodes: data.nodes,
            edges: data.edges || [],
          };
          setMessages((prev) => [...prev, assistantMessage]);
        } else {
          const errorMsg = data.errors?.join(', ') || 'Could not generate strategy';
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content: `I couldn't generate that strategy. ${errorMsg}\n\nTry describing it differently, like:\n${EXAMPLE_PROMPTS.generate.join('\n')}`,
              error: true,
            },
          ]);
        }
      } else if (panelMode === 'code') {
        // Code generation mode - generate code via AI
        const codeGenPrompt = `Generate ${codeLanguage === 'pinescript' ? 'Pine Script v5' : codeLanguage.toUpperCase()} code for: ${input}`;

        const response = await fetch(`${backendUrl}/api/strategy-flow/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: codeGenPrompt,
            currentNodes: nodes,
            currentEdges: edges,
            codeMode: true,
            targetLanguage: codeLanguage,
          }),
        });

        if (!response.ok) throw new Error(`API error: ${response.status}`);

        const data = await response.json();
        const responseText = data.response || '';

        // Try to extract code blocks from the response
        const codeBlockMatch = responseText.match(/```(?:\w+)?\n([\s\S]*?)```/);
        const extractedCode = codeBlockMatch ? codeBlockMatch[1].trim() : null;

        const assistantMessage: Message = {
          role: 'assistant',
          content: responseText,
          codeBlock: extractedCode
            ? { language: codeLanguage, code: extractedCode }
            : undefined,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      } else {
        // Chat mode
        const response = await fetch(`${backendUrl}/api/strategy-flow/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: input,
            currentNodes: nodes,
            currentEdges: edges,
          }),
        });

        if (!response.ok) throw new Error(`API error: ${response.status}`);

        const data = await response.json();
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.response || "I couldn't process that question.",
          },
        ]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          error: true,
        },
      ]);
    } finally {
      setIsLoading(false);
      setGenerationProgress(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearMessages = () => {
    setMessages([]);
  };

  if (!open) return null;

  return (
    <div 
      className="fixed right-0 top-0 bottom-0 glass border-l border-border/50 flex flex-col z-50 shadow-trading-lg animate-in slide-in-from-right duration-300"
      style={{ width: rightPanelWidth }}
    >
      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b border-border/50 bg-card/50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-pink-500" />
          <span className="text-sm font-medium truncate">AI Strategy Builder</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={clearMessages}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear chat</TooltipContent>
            </Tooltip>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="px-3 py-2 border-b border-border/50">

        {/* Mode Tabs */}
        <div className="flex gap-1 mb-2">
          <Button
            onClick={() => setPanelMode('generate')}
            variant={panelMode === 'generate' ? 'default' : 'secondary'}
            size="sm"
            className={`flex-1 h-7 text-xs font-medium ${
              panelMode === 'generate'
                ? 'bg-pink-500 hover:bg-pink-600 text-white'
                : 'bg-muted/50 hover:bg-muted text-muted-foreground'
            }`}
          >
            <Blocks className="w-3 h-3 mr-1" />
            Generate
          </Button>
          <Button
            onClick={() => setPanelMode('code')}
            variant={panelMode === 'code' ? 'default' : 'secondary'}
            size="sm"
            className={`flex-1 h-7 text-xs font-medium ${
              panelMode === 'code'
                ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                : 'bg-muted/50 hover:bg-muted text-muted-foreground'
            }`}
          >
            <Terminal className="w-3 h-3 mr-1" />
            Code
          </Button>
          <Button
            onClick={() => setPanelMode('chat')}
            variant={panelMode === 'chat' ? 'default' : 'secondary'}
            size="sm"
            className={`flex-1 h-7 text-xs font-medium ${
              panelMode === 'chat'
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-muted/50 hover:bg-muted text-muted-foreground'
            }`}
          >
            <MessageSquare className="w-3 h-3 mr-1" />
            Chat
          </Button>
        </div>

        {/* Sub-options per mode */}
        {panelMode === 'generate' && (
          <div className="flex gap-1">
            <button
              onClick={() => setGenMode('fast')}
              className={`flex-1 text-[10px] py-1 rounded transition-colors ${
                genMode === 'fast'
                  ? 'bg-pink-500/20 text-pink-400 font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              Fast
            </button>
            <button
              onClick={() => setGenMode('slow')}
              className={`flex-1 text-[10px] py-1 rounded transition-colors ${
                genMode === 'slow'
                  ? 'bg-pink-500/20 text-pink-400 font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              Precise
            </button>
            <button
              onClick={() => setGenMode('tool-calling')}
              className={`flex-1 text-[10px] py-1 rounded transition-colors flex items-center justify-center gap-0.5 ${
                genMode === 'tool-calling'
                  ? 'bg-purple-500/20 text-purple-400 font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              <Wrench className="w-2.5 h-2.5" />
              Tools
            </button>
          </div>
        )}

        {panelMode === 'code' && (
          <div className="flex gap-1">
            <button
              onClick={() => setCodeLanguage('pinescript')}
              className={`flex-1 text-[10px] py-1 rounded transition-colors flex items-center justify-center gap-0.5 ${
                codeLanguage === 'pinescript'
                  ? 'bg-[#2962FF]/20 text-[#2962FF] font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              <LineChart className="w-2.5 h-2.5" />
              Pine Script
            </button>
            <button
              onClick={() => setCodeLanguage('python')}
              className={`flex-1 text-[10px] py-1 rounded transition-colors flex items-center justify-center gap-0.5 ${
                codeLanguage === 'python'
                  ? 'bg-yellow-500/20 text-yellow-400 font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              <FileCode className="w-2.5 h-2.5" />
              Python
            </button>
            <button
              onClick={() => setCodeLanguage('mql5')}
              className={`flex-1 text-[10px] py-1 rounded transition-colors flex items-center justify-center gap-0.5 ${
                codeLanguage === 'mql5'
                  ? 'bg-cyan-500/20 text-cyan-400 font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
              }`}
            >
              <FileCode className="w-2.5 h-2.5" />
              MQL5
            </button>
          </div>
        )}
      </div>

      {/* Code Preview (when in code mode with existing nodes) */}
      {panelMode === 'code' && currentCode && currentCode.code && (
        <div className="border-b border-border/50">
          <div className="px-4 py-2 flex items-center justify-between bg-card/50">
            <span className="text-[11px] text-muted-foreground font-medium">
              Generated from {nodes.length} nodes
            </span>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleCopyCode(currentCode.code, 'preview')}
                  >
                    {copied === 'preview' ? (
                      <Check className="w-3 h-3 text-green-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy code</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleDownloadCode(currentCode.code, codeLanguage)}
                  >
                    <Download className="w-3 h-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Download code</TooltipContent>
              </Tooltip>
            </div>
          </div>
          {(currentCode.errors.length > 0 || currentCode.warnings.length > 0) && (
            <div className="px-4 py-1.5 bg-destructive/5">
              {currentCode.errors.map((err, i) => (
                <div key={`e-${i}`} className="text-red-400 text-[10px]">
                  ⚠ {err}
                </div>
              ))}
              {currentCode.warnings.map((warn, i) => (
                <div key={`w-${i}`} className="text-yellow-400 text-[10px]">
                  ⚡ {warn}
                </div>
              ))}
            </div>
          )}
          <ScrollArea className="max-h-[200px]">
            <pre className="px-4 py-2 text-[11px] font-mono leading-5 text-foreground/70 overflow-x-auto">
              <code>{currentCode.code}</code>
            </pre>
          </ScrollArea>
        </div>
      )}

      {/* Messages Area */}
      <ScrollArea className="flex-1 px-3 py-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-10">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${
                panelMode === 'generate'
                  ? 'bg-pink-500/10'
                  : panelMode === 'code'
                    ? 'bg-emerald-500/10'
                    : 'bg-blue-500/10'
              }`}
            >
              {panelMode === 'generate' ? (
                <Sparkles className="w-5 h-5 text-pink-500/70" />
              ) : panelMode === 'code' ? (
                <Terminal className="w-5 h-5 text-emerald-500/70" />
              ) : (
                <MessageSquare className="w-5 h-5 text-blue-500/70" />
              )}
            </div>
            <p className="text-xs text-foreground/70 mb-1 font-medium">
              {panelMode === 'generate'
                ? 'Describe your trading strategy'
                : panelMode === 'code'
                  ? `Generate ${codeLanguage === 'pinescript' ? 'Pine Script' : codeLanguage} code`
                  : 'Ask about trading strategies'}
            </p>
            <p className="text-[10px] text-muted-foreground mb-3">
              {panelMode === 'generate'
                ? 'AI will create flow nodes for your strategy'
                : panelMode === 'code'
                  ? 'AI will generate executable trading code'
                  : 'AI can answer questions about your strategy'}
            </p>
            <div className="space-y-1.5 w-full">
              {EXAMPLE_PROMPTS[panelMode].slice(0, 3).map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => setInput(prompt.replace(/"/g, ''))}
                  className="w-full text-left px-3 py-1.5 rounded-md bg-muted/50 hover:bg-muted text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[90%] rounded-lg p-2.5 ${
                    msg.role === 'user'
                      ? 'bg-pink-500/15 text-foreground border border-pink-500/20'
                      : msg.error
                        ? 'bg-destructive/10 border border-destructive/20 text-foreground'
                        : 'bg-muted/50 text-foreground border border-border/30'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="text-xs prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => (
                            <p className="mb-1.5 last:mb-0 text-xs leading-relaxed">{children}</p>
                          ),
                          ul: ({ children }) => (
                            <ul className="list-disc ml-3 mb-1.5 text-xs">{children}</ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="list-decimal ml-3 mb-1.5 text-xs">{children}</ol>
                          ),
                          li: ({ children }) => <li className="mb-0.5 text-xs">{children}</li>,
                          strong: ({ children }) => (
                            <strong className="font-semibold text-foreground">{children}</strong>
                          ),
                          em: ({ children }) => (
                            <em className="italic text-muted-foreground">{children}</em>
                          ),
                          code: ({ className, children }) => {
                            const isBlock = className?.includes('language-');
                            if (isBlock) {
                              return (
                                <div className="relative group my-2">
                                  <pre className="bg-black/30 rounded-md p-2.5 overflow-x-auto border border-border/50">
                                    <code className="text-[10px] font-mono leading-5 text-emerald-300">
                                      {children}
                                    </code>
                                  </pre>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-1.5 right-1.5 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity bg-muted/80"
                                    onClick={() => handleCopyCode(String(children), `msg-${idx}`)}
                                  >
                                    {copied === `msg-${idx}` ? (
                                      <Check className="w-3 h-3 text-green-400" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </Button>
                                </div>
                              );
                            }
                            return (
                              <code className="bg-muted px-1 py-0.5 rounded text-[10px] text-pink-300">
                                {children}
                              </code>
                            );
                          },
                          pre: ({ children }) => <>{children}</>,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>

                      {/* Code block with actions */}
                      {msg.codeBlock && (
                        <div className="mt-2 rounded-md border border-border/50 overflow-hidden">
                          <div className="flex items-center justify-between px-2.5 py-1 bg-card/50 border-b border-border/50">
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                              {msg.codeBlock.language === 'pinescript'
                                ? 'Pine Script'
                                : msg.codeBlock.language}
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={() =>
                                  handleCopyCode(msg.codeBlock!.code, `block-${idx}`)
                                }
                              >
                                {copied === `block-${idx}` ? (
                                  <Check className="w-3 h-3 text-green-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={() =>
                                  handleDownloadCode(
                                    msg.codeBlock!.code,
                                    msg.codeBlock!.language as CodeLanguage
                                  )
                                }
                              >
                                <Download className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                          <ScrollArea className="max-h-[250px]">
                            <pre className="p-2.5 text-[10px] font-mono leading-5 text-emerald-300 overflow-x-auto">
                              <code>{msg.codeBlock.code}</code>
                            </pre>
                          </ScrollArea>
                        </div>
                      )}

                      {/* Add to Canvas buttons */}
                      {msg.nodes && msg.nodes.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/50 space-y-1.5">
                          <Button
                            size="sm"
                            onClick={() => addNodesToCanvas(msg.nodes!, msg.edges || [], false)}
                            className="w-full h-7 text-xs bg-green-600 hover:bg-green-700 font-medium"
                          >
                            <Blocks className="w-3 h-3 mr-1" />
                            Add {msg.nodes.length} Nodes
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addNodesToCanvas(msg.nodes!, msg.edges || [], true)}
                            className="w-full h-7 text-xs border-border/50 text-muted-foreground hover:text-foreground"
                          >
                            Replace Canvas
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}

            {/* Loading State */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted/50 rounded-lg p-2.5 max-w-[90%] border border-border/30">
                  {generationProgress ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin text-pink-500" />
                        <span className="text-xs text-muted-foreground">{generationProgress.message}...</span>
                      </div>

                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-500 rounded-full"
                          style={{
                            width: `${(generationProgress.step / generationProgress.totalSteps) * 100}%`,
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>
                          Step {generationProgress.step} of {generationProgress.totalSteps}
                        </span>
                        <span className="px-2 py-0.5 bg-pink-500/20 rounded-full text-pink-400 text-[10px] font-medium">
                          {generationProgress.phase}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin text-pink-500" />
                      <span className="text-xs text-muted-foreground">
                        {panelMode === 'generate'
                          ? 'Generating nodes...'
                          : panelMode === 'code'
                            ? `Generating ${codeLanguage === 'pinescript' ? 'Pine Script' : codeLanguage}...`
                            : 'Thinking...'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className="px-3 py-2.5 border-t border-border/50">
        {/* Workspace context indicator */}
        {nodes.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 mb-2 bg-muted/50 rounded text-[10px] text-muted-foreground">
            <Eye className="w-2.5 h-2.5" />
            <span>
              AI can see your workspace ({nodes.length} nodes
              {panelMode === 'code' ? ` · ${codeLanguage}` : ''})
            </span>
          </div>
        )}

        <div className="flex gap-1.5">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={
              panelMode === 'generate'
                ? 'Describe your strategy...'
                : panelMode === 'code'
                  ? `Describe ${codeLanguage === 'pinescript' ? 'Pine Script' : codeLanguage} code...`
                  : 'Ask a question...'
            }
            disabled={isLoading}
            className="flex-1 h-8 text-xs bg-muted/50 border-border/50 placeholder:text-muted-foreground/50 focus:border-primary/50 transition-colors"
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            size="icon"
            className={`h-8 w-8 ${
              panelMode === 'generate'
                ? 'bg-pink-500 hover:bg-pink-600'
                : panelMode === 'code'
                  ? 'bg-emerald-500 hover:bg-emerald-600'
                  : 'bg-blue-500 hover:bg-blue-600'
            } disabled:opacity-40`}
          >
            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AIChatPanel;
