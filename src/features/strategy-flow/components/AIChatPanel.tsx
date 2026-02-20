/**
 * AIChatPanel - AI-powered strategy builder for Strategy Flow
 * Glassmorphism design matching the Blockly version
 * Features: Generate/Chat modes, Fast/Slow toggle, progress tracking
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  Send,
  Sparkles,
  MessageSquare,
  Code,
  Blocks,
  X,
  Eye,
  Wrench,
} from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { useStrategyFlowStore } from '../store/strategyFlowStore';
import type { StrategyFlowNode, StrategyFlowEdge } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  nodes?: StrategyFlowNode[];
  edges?: StrategyFlowEdge[];
  error?: boolean;
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
};

export const AIChatPanel = ({ open, onOpenChange }: AIChatPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerateMode, setIsGenerateMode] = useState(true);
  const [genMode, setGenMode] = useState<'fast' | 'slow' | 'tool-calling'>('fast');
  const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { nodes, edges, addNode, clearCanvas, setNodes, setEdges } = useStrategyFlowStore();
  
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Simulate generation progress
  const simulateProgress = useCallback(() => {
    const steps = genMode === 'slow' ? 5 : genMode === 'tool-calling' ? 6 : 4;
    const phases = genMode === 'slow' 
      ? ['Analyzing', 'Building nodes', 'Connecting edges', 'Validating', 'Optimizing']
      : genMode === 'tool-calling'
      ? ['Planning', 'Adding indicators', 'Adding conditions', 'Adding actions', 'Connecting nodes', 'Finishing']
      : ['Analyzing', 'Building nodes', 'Connecting edges', 'Finalizing'];
    
    let step = 1;
    const interval = setInterval(() => {
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
    }, genMode === 'slow' ? 3000 : genMode === 'tool-calling' ? 2000 : 1500);

    return () => clearInterval(interval);
  }, [genMode]);

  // Add generated nodes to canvas
  const addNodesToCanvas = useCallback((newNodes: StrategyFlowNode[], newEdges: StrategyFlowEdge[], replace: boolean = false) => {
    if (replace) {
      // Replace entire canvas
      setNodes(newNodes);
      setEdges(newEdges);
      toast.success(`Replaced canvas with ${newNodes.length} nodes`);
    } else {
      // Add to existing canvas with offset
      const existingNodes = useStrategyFlowStore.getState().nodes;
      const existingEdges = useStrategyFlowStore.getState().edges;
      
      // Calculate offset to avoid overlap
      const maxX = existingNodes.reduce((max, n) => Math.max(max, n.position.x), 0);
      const offsetX = maxX > 0 ? maxX + 300 : 0;
      
      // Offset new nodes
      const offsetNodes = newNodes.map(node => ({
        ...node,
        id: `${node.id}-${Date.now()}`,
        position: {
          x: node.position.x + offsetX,
          y: node.position.y,
        },
      }));
      
      // Update edge references
      const idMap = new Map(newNodes.map((n, i) => [n.id, offsetNodes[i].id]));
      const offsetEdges = newEdges.map(edge => ({
        ...edge,
        id: `${edge.id}-${Date.now()}`,
        source: idMap.get(edge.source) || edge.source,
        target: idMap.get(edge.target) || edge.target,
      }));
      
      setNodes([...existingNodes, ...offsetNodes]);
      setEdges([...existingEdges, ...offsetEdges]);
      toast.success(`Added ${newNodes.length} nodes to canvas`);
    }
  }, [setNodes, setEdges]);

  // Handle send message
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setGenerationProgress(null);

    try {
      if (isGenerateMode) {
        // Start progress simulation
        const cleanup = simulateProgress();

        // Call generate endpoint
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

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.nodes?.length > 0) {
          const modeLabel = data.generationMode === 'tool-calling' ? ' via tool calling' : '';
          const assistantMessage: Message = {
            role: 'assistant',
            content: (data.message || `Generated strategy with ${data.nodes.length} nodes.`) +
              (modeLabel ? `\n\n*Built${modeLabel}.*` : '') +
              (data.wasRationalized ? '\n\n*Strategy was optimized for better logic.*' : '') +
              (data.autoFixed ? '\n\n*Some parameters were auto-corrected.*' : ''),
            nodes: data.nodes,
            edges: data.edges || [],
          };
          setMessages(prev => [...prev, assistantMessage]);
        } else {
          const errorMsg = data.errors?.join(', ') || 'Could not generate strategy';
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: `I couldn't generate that strategy. ${errorMsg}\n\nTry describing it differently, like:\n${EXAMPLE_PROMPTS.generate.join('\n')}`,
            error: true,
          }]);
        }
      } else {
        // Chat mode - Q&A about strategies
        const response = await fetch(`${backendUrl}/api/strategy-flow/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: input,
            currentNodes: nodes,
            currentEdges: edges,
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.response || 'I couldn\'t process that question.',
        }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: true,
      }]);
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

  if (!open) return null;

  return (
    <div className="w-72 bg-card/80 backdrop-blur-xl border-l border-white/10 flex flex-col overflow-hidden animate-fade-in h-full">
      {/* Header */}
      <div className="px-2.5 py-1.5 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-pink-500" />
            <span className="text-xs font-medium text-foreground">AI Strategy Builder</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-1.5 mb-2">
          <Button
            onClick={() => setIsGenerateMode(true)}
            variant={isGenerateMode ? 'default' : 'secondary'}
            size="sm"
            className={`flex-1 h-7 text-xs ${isGenerateMode ? 'bg-pink-500 hover:bg-pink-600 text-white' : 'bg-secondary hover:bg-secondary/80'}`}
          >
            <Code className="w-3 h-3 mr-1" />
            Generate
          </Button>
          <Button
            onClick={() => setIsGenerateMode(false)}
            variant={!isGenerateMode ? 'default' : 'secondary'}
            size="sm"
            className={`flex-1 h-7 text-xs ${!isGenerateMode ? 'bg-pink-500 hover:bg-pink-600 text-white' : 'bg-secondary hover:bg-secondary/80'}`}
          >
            <MessageSquare className="w-3 h-3 mr-1" />
            Chat
          </Button>
        </div>

        {/* Generation Mode Selector (Generate mode only) */}
        {isGenerateMode && (
          <div className="flex gap-1 px-1">
            <button
              onClick={() => setGenMode('fast')}
              className={`flex-1 text-[10px] py-1 rounded transition-colors ${
                genMode === 'fast'
                  ? 'bg-pink-500/20 text-pink-400 font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
            >
              Fast
            </button>
            <button
              onClick={() => setGenMode('slow')}
              className={`flex-1 text-[10px] py-1 rounded transition-colors ${
                genMode === 'slow'
                  ? 'bg-pink-500/20 text-pink-400 font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
            >
              Precise
            </button>
            <button
              onClick={() => setGenMode('tool-calling')}
              className={`flex-1 text-[10px] py-1 rounded transition-colors flex items-center justify-center gap-0.5 ${
                genMode === 'tool-calling'
                  ? 'bg-purple-500/20 text-purple-400 font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
              }`}
            >
              <Wrench className="w-2.5 h-2.5" />
              Tools
            </button>
          </div>
        )}
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 px-2.5 py-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Sparkles className="w-8 h-8 text-pink-500/50 mb-3" />
            <p className="text-xs text-muted-foreground mb-3">
              {isGenerateMode
                ? 'Describe your trading strategy'
                : 'Ask about trading strategies'}
            </p>
            <div className="space-y-1.5 text-[10px] text-muted-foreground/70">
              {(isGenerateMode ? EXAMPLE_PROMPTS.generate : EXAMPLE_PROMPTS.chat).slice(0, 3).map((prompt, i) => (
                <p key={i} className="italic">{prompt}</p>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] rounded-lg p-2 ${
                    msg.role === 'user'
                      ? 'bg-pink-500/20 text-foreground'
                      : msg.error
                      ? 'bg-red-500/10 border border-red-500/20 text-foreground'
                      : 'bg-muted text-foreground'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="text-xs prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-1.5 last:mb-0 text-xs">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc ml-3 mb-1.5 text-xs">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal ml-3 mb-1.5 text-xs">{children}</ol>,
                          li: ({ children }) => <li className="mb-0.5 text-xs">{children}</li>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                          em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
                          code: ({ children }) => (
                            <code className="bg-white/10 px-1 py-0.5 rounded text-[10px]">{children}</code>
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>

                      {/* Add to Canvas buttons */}
                      {msg.nodes && msg.nodes.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-white/10 space-y-1.5">
                          <Button
                            size="sm"
                            onClick={() => addNodesToCanvas(msg.nodes!, msg.edges || [], false)}
                            className="w-full h-7 text-xs bg-green-600 hover:bg-green-700"
                          >
                            <Blocks className="w-3 h-3 mr-1" />
                            Add {msg.nodes.length} Nodes
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addNodesToCanvas(msg.nodes!, msg.edges || [], true)}
                            className="w-full h-7 text-xs border-white/20 text-muted-foreground hover:text-foreground"
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
                <div className="bg-muted rounded-lg p-2 max-w-[90%]">
                  {generationProgress ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin text-pink-500" />
                        <span className="text-xs text-muted-foreground">
                          {generationProgress.message}...
                        </span>
                      </div>
                      
                      {/* Progress bar */}
                      <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-pink-500 to-purple-500 transition-all duration-500"
                          style={{ width: `${(generationProgress.step / generationProgress.totalSteps) * 100}%` }}
                        />
                      </div>
                      
                      {/* Step indicator */}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>Step {generationProgress.step} of {generationProgress.totalSteps}</span>
                        <span className="px-1.5 py-0.5 bg-pink-500/20 rounded text-pink-400">
                          {generationProgress.phase}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3 h-3 animate-spin text-pink-500" />
                      <span className="text-xs text-muted-foreground">
                        {isGenerateMode ? 'Generating...' : 'Thinking...'}
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
      <div className="p-3 border-t border-white/10">
        {/* Workspace context indicator (chat mode) */}
        {!isGenerateMode && nodes.length > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-1 mb-2 bg-white/5 rounded text-[10px] text-muted-foreground">
            <Eye className="w-2.5 h-2.5" />
            <span>AI can see your workspace ({nodes.length} nodes)</span>
          </div>
        )}

        <div className="flex gap-1.5">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={isGenerateMode ? 'Describe your strategy...' : 'Ask a question...'}
            disabled={isLoading}
            className="flex-1 h-8 text-xs bg-secondary border-white/10 placeholder:text-muted-foreground/50"
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            size="icon"
            className="h-8 w-8 bg-pink-500 hover:bg-pink-600 disabled:bg-pink-500/50"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AIChatPanel;
