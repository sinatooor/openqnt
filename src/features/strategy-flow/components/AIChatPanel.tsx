/**
 * AIChatPanel - AI-powered strategy builder for ReactFlow
 * Can generate nodes from natural language and answer questions about strategies
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Loader2,
  Send,
  Sparkles,
  MessageSquare,
  Code,
  Blocks,
  X,
  Eye,
  Wand2,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { useStrategyFlowStore } from '../store/strategyFlowStore';
import { NODE_CATALOG } from '../catalog/nodeCatalog';
import { StrategyFlowNode, StrategyFlowEdge, NodeCatalogItem } from '../types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  nodes?: StrategyFlowNode[];
  edges?: StrategyFlowEdge[];
  error?: boolean;
}

interface AIChatPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Strategy patterns the AI can recognize and generate
const STRATEGY_PATTERNS = {
  'sma crossover': {
    description: 'SMA crossover strategy',
    nodes: ['sma', 'sma', 'crossover', 'order'],
  },
  'ema crossover': {
    description: 'EMA crossover strategy',
    nodes: ['ema', 'ema', 'crossover', 'order'],
  },
  'rsi oversold': {
    description: 'RSI oversold bounce strategy',
    nodes: ['rsi', 'threshold', 'order'],
  },
  'rsi overbought': {
    description: 'RSI overbought reversal strategy',
    nodes: ['rsi', 'threshold', 'order'],
  },
  'macd signal': {
    description: 'MACD signal line crossover',
    nodes: ['macd', 'crossover', 'order'],
  },
  'bollinger breakout': {
    description: 'Bollinger Band breakout strategy',
    nodes: ['bb', 'price', 'compare', 'order'],
  },
};

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 9);

export const AIChatPanel = ({ open, onOpenChange }: AIChatPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerateMode, setIsGenerateMode] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { nodes, edges, addNode, clearCanvas, strategyName } = useStrategyFlowStore();

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Parse user intent and generate nodes
  const generateNodesFromPrompt = useCallback((prompt: string): { nodes: StrategyFlowNode[]; edges: StrategyFlowEdge[] } | null => {
    const lowerPrompt = prompt.toLowerCase();
    const generatedNodes: StrategyFlowNode[] = [];
    const generatedEdges: StrategyFlowEdge[] = [];

    // Check for pattern matches
    let matchedPattern: string | null = null;
    for (const pattern of Object.keys(STRATEGY_PATTERNS)) {
      if (lowerPrompt.includes(pattern)) {
        matchedPattern = pattern;
        break;
      }
    }

    // Extract parameters from prompt
    const periodMatch = lowerPrompt.match(/(\d+)\s*(?:period|day|bar)/);
    const fastPeriodMatch = lowerPrompt.match(/fast\s*(?:period|ma|ema|sma)?\s*(?:of\s*)?(\d+)/);
    const slowPeriodMatch = lowerPrompt.match(/slow\s*(?:period|ma|ema|sma)?\s*(?:of\s*)?(\d+)/);
    const rsiValueMatch = lowerPrompt.match(/(?:rsi|below|above|under|over)\s*(\d+)/);
    
    const defaultPeriod = periodMatch ? parseInt(periodMatch[1]) : 14;
    const fastPeriod = fastPeriodMatch ? parseInt(fastPeriodMatch[1]) : 10;
    const slowPeriod = slowPeriodMatch ? parseInt(slowPeriodMatch[1]) : 20;
    const rsiThreshold = rsiValueMatch ? parseInt(rsiValueMatch[1]) : 30;

    // Determine direction
    const isBuy = lowerPrompt.includes('buy') || lowerPrompt.includes('long') || 
                  lowerPrompt.includes('oversold') || lowerPrompt.includes('below');
    const isSell = lowerPrompt.includes('sell') || lowerPrompt.includes('short') || 
                   lowerPrompt.includes('overbought') || lowerPrompt.includes('above');

    // Generate nodes based on detected patterns
    let yOffset = 100;
    let xOffset = 100;

    // Detect indicators mentioned
    const hasSMA = lowerPrompt.includes('sma') || lowerPrompt.includes('simple moving average');
    const hasEMA = lowerPrompt.includes('ema') || lowerPrompt.includes('exponential moving average');
    const hasRSI = lowerPrompt.includes('rsi') || lowerPrompt.includes('relative strength');
    const hasMACD = lowerPrompt.includes('macd');
    const hasBB = lowerPrompt.includes('bollinger') || lowerPrompt.includes('bb band');
    const hasCrossover = lowerPrompt.includes('cross') || lowerPrompt.includes('crossover');

    // Generate indicator nodes
    if (hasSMA || (matchedPattern?.includes('sma'))) {
      // Fast SMA
      generatedNodes.push({
        id: `sma-fast-${generateId()}`,
        type: 'indicator',
        position: { x: xOffset, y: yOffset },
        data: {
          label: `SMA ${fastPeriod}`,
          indicatorType: 'sma',
          timeframe: '60',
          params: { period: fastPeriod },
        },
      });
      yOffset += 130;

      // Slow SMA for crossover
      if (hasCrossover || matchedPattern?.includes('crossover')) {
        generatedNodes.push({
          id: `sma-slow-${generateId()}`,
          type: 'indicator',
          position: { x: xOffset, y: yOffset },
          data: {
            label: `SMA ${slowPeriod}`,
            indicatorType: 'sma',
            timeframe: '60',
            params: { period: slowPeriod },
          },
        });
        yOffset += 130;
      }
    }

    if (hasEMA || (matchedPattern?.includes('ema'))) {
      generatedNodes.push({
        id: `ema-fast-${generateId()}`,
        type: 'indicator',
        position: { x: xOffset, y: yOffset },
        data: {
          label: `EMA ${fastPeriod}`,
          indicatorType: 'ema',
          timeframe: '60',
          params: { period: fastPeriod },
        },
      });
      yOffset += 130;

      if (hasCrossover || matchedPattern?.includes('crossover')) {
        generatedNodes.push({
          id: `ema-slow-${generateId()}`,
          type: 'indicator',
          position: { x: xOffset, y: yOffset },
          data: {
            label: `EMA ${slowPeriod}`,
            indicatorType: 'ema',
            timeframe: '60',
            params: { period: slowPeriod },
          },
        });
        yOffset += 130;
      }
    }

    if (hasRSI || matchedPattern?.includes('rsi')) {
      generatedNodes.push({
        id: `rsi-${generateId()}`,
        type: 'indicator',
        position: { x: xOffset, y: yOffset },
        data: {
          label: `RSI ${defaultPeriod}`,
          indicatorType: 'rsi',
          timeframe: '60',
          params: { period: defaultPeriod },
        },
      });
      yOffset += 130;
    }

    if (hasMACD || matchedPattern?.includes('macd')) {
      generatedNodes.push({
        id: `macd-${generateId()}`,
        type: 'indicator',
        position: { x: xOffset, y: yOffset },
        data: {
          label: 'MACD',
          indicatorType: 'macd',
          timeframe: '60',
          params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 },
        },
      });
      yOffset += 130;
    }

    if (hasBB || matchedPattern?.includes('bollinger')) {
      generatedNodes.push({
        id: `bb-${generateId()}`,
        type: 'indicator',
        position: { x: xOffset, y: yOffset },
        data: {
          label: 'Bollinger Bands',
          indicatorType: 'bb',
          timeframe: '60',
          params: { period: 20, stdDev: 2 },
        },
      });
      yOffset += 130;
    }

    // Add condition node
    xOffset = 350;
    yOffset = 150;

    if (hasCrossover && generatedNodes.length >= 2) {
      const crossoverId = `crossover-${generateId()}`;
      generatedNodes.push({
        id: crossoverId,
        type: 'condition',
        position: { x: xOffset, y: yOffset },
        data: {
          label: 'Crossover',
          conditionType: 'crossover',
        },
      });

      // Connect first two indicators to crossover
      generatedEdges.push({
        id: `e-${generatedNodes[0].id}-${crossoverId}`,
        source: generatedNodes[0].id,
        target: crossoverId,
      });
      generatedEdges.push({
        id: `e-${generatedNodes[1].id}-${crossoverId}`,
        source: generatedNodes[1].id,
        target: crossoverId,
      });
    } else if (hasRSI || matchedPattern?.includes('rsi')) {
      const thresholdId = `threshold-${generateId()}`;
      const operator = isBuy ? '<' : '>';
      generatedNodes.push({
        id: thresholdId,
        type: 'condition',
        position: { x: xOffset, y: yOffset },
        data: {
          label: `RSI ${operator} ${rsiThreshold}`,
          conditionType: 'threshold',
          operator,
          value: rsiThreshold,
        },
      });

      // Connect RSI to threshold
      const rsiNode = generatedNodes.find(n => (n.data as any).indicatorType === 'rsi');
      if (rsiNode) {
        generatedEdges.push({
          id: `e-${rsiNode.id}-${thresholdId}`,
          source: rsiNode.id,
          target: thresholdId,
        });
      }
    }

    // Add action node
    xOffset = 600;
    const lastConditionNode = generatedNodes.find(n => n.type === 'condition');
    
    if (isBuy || isSell || lastConditionNode) {
      const actionId = `order-${generateId()}`;
      generatedNodes.push({
        id: actionId,
        type: 'action',
        position: { x: xOffset, y: yOffset },
        data: {
          label: isSell ? 'Sell' : 'Buy',
          actionType: 'order',
          direction: isSell ? 'short' : 'long',
          size: 10,
          sizeType: 'percent',
        },
      });

      // Connect condition to action
      if (lastConditionNode) {
        generatedEdges.push({
          id: `e-${lastConditionNode.id}-${actionId}`,
          source: lastConditionNode.id,
          target: actionId,
        });
      }
    }

    // Return null if no meaningful nodes generated
    if (generatedNodes.length === 0) {
      return null;
    }

    return { nodes: generatedNodes, edges: generatedEdges };
  }, []);

  // Add generated nodes to canvas
  const addNodesToCanvas = useCallback((nodes: StrategyFlowNode[], edges: StrategyFlowEdge[], clearFirst: boolean = false) => {
    const store = useStrategyFlowStore.getState();
    
    if (clearFirst) {
      store.clearCanvas();
    }

    // Add nodes
    nodes.forEach(node => {
      const catalogItem = NODE_CATALOG.find(item => 
        item.type === (node.data as any).indicatorType || 
        item.type === (node.data as any).conditionType ||
        item.type === (node.data as any).actionType
      );
      
      if (catalogItem) {
        store.addNode(catalogItem, node.position);
      }
    });

    toast.success(`Added ${nodes.length} nodes to canvas`);
  }, []);

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

    try {
      if (isGenerateMode) {
        // Generate mode - create nodes from prompt
        const result = generateNodesFromPrompt(input);
        
        if (result && result.nodes.length > 0) {
          const assistantMessage: Message = {
            role: 'assistant',
            content: `I've generated a strategy with ${result.nodes.length} nodes:\n\n` +
              result.nodes.map(n => `• **${n.data.label}** (${n.type})`).join('\n') +
              `\n\nClick "Add to Canvas" to add these nodes to your strategy.`,
            nodes: result.nodes,
            edges: result.edges,
          };
          setMessages(prev => [...prev, assistantMessage]);
        } else {
          // Try calling the backend API
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-strategy-flow`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: JSON.stringify({
                message: input,
                currentNodes: nodes,
                currentEdges: edges,
              }),
            }
          );

          if (response.ok) {
            const data = await response.json();
            if (data.nodes && data.nodes.length > 0) {
              const assistantMessage: Message = {
                role: 'assistant',
                content: data.message || `Generated ${data.nodes.length} nodes.`,
                nodes: data.nodes,
                edges: data.edges || [],
              };
              setMessages(prev => [...prev, assistantMessage]);
            }
          } else {
            // Fallback response
            const assistantMessage: Message = {
              role: 'assistant',
              content: `I understand you want to create a strategy, but I couldn't parse the specific pattern. Try describing your strategy using common terms like:\n\n` +
                `• "SMA crossover with fast 10 slow 20"\n` +
                `• "RSI below 30 buy signal"\n` +
                `• "MACD signal crossover"\n` +
                `• "Bollinger band breakout"\n\n` +
                `Or drag nodes from the left sidebar to build your strategy manually.`,
            };
            setMessages(prev => [...prev, assistantMessage]);
          }
        }
      } else {
        // Chat mode - answer questions
        const workspaceContext = nodes.length > 0 
          ? `The current strategy has ${nodes.length} nodes: ${nodes.map(n => n.data.label).join(', ')}.`
          : 'The workspace is currently empty.';

        // Try calling conversational chat endpoint
        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/conversational-chat`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: JSON.stringify({
                messages: [...messages, userMessage].map(m => ({
                  role: m.role,
                  content: m.content,
                })),
                workspaceContext,
              }),
            }
          );

          if (response.ok) {
            const data = await response.json();
            const assistantMessage: Message = {
              role: 'assistant',
              content: data.message || data.response,
            };
            setMessages(prev => [...prev, assistantMessage]);
          } else {
            throw new Error('API call failed');
          }
        } catch {
          // Fallback - provide helpful response
          const assistantMessage: Message = {
            role: 'assistant',
            content: getChatResponse(input, nodes),
          };
          setMessages(prev => [...prev, assistantMessage]);
        }
      }
    } catch (error) {
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        error: true,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Simple chat responses for common questions
  const getChatResponse = (question: string, currentNodes: StrategyFlowNode[]): string => {
    const lower = question.toLowerCase();
    
    if (lower.includes('what is') && lower.includes('rsi')) {
      return `**RSI (Relative Strength Index)** is a momentum oscillator that measures the speed and magnitude of price movements.\n\n` +
        `• **Range**: 0-100\n` +
        `• **Oversold**: Below 30 (potential buy signal)\n` +
        `• **Overbought**: Above 70 (potential sell signal)\n` +
        `• **Default Period**: 14\n\n` +
        `To use RSI in your strategy, drag the RSI indicator from the sidebar and connect it to a threshold condition.`;
    }
    
    if (lower.includes('what is') && (lower.includes('sma') || lower.includes('moving average'))) {
      return `**SMA (Simple Moving Average)** is a trend-following indicator that calculates the average price over a specified period.\n\n` +
        `• **Common periods**: 10, 20, 50, 200\n` +
        `• **Crossover signals**: Fast MA crosses slow MA\n` +
        `• **Golden Cross**: Fast crosses above slow (bullish)\n` +
        `• **Death Cross**: Fast crosses below slow (bearish)\n\n` +
        `To create a crossover strategy, drag two SMA indicators and connect them to a Crossover condition.`;
    }

    if (lower.includes('how') && (lower.includes('backtest') || lower.includes('test'))) {
      return `To backtest your strategy:\n\n` +
        `1. Build your strategy using indicator, condition, and action nodes\n` +
        `2. Click the **Backtest** button in the top toolbar\n` +
        `3. Configure your backtest parameters (symbol, dates, capital)\n` +
        `4. Click **Run Backtest** to see results\n\n` +
        `The backtest will show metrics like profit/loss, win rate, and drawdown.`;
    }

    if (currentNodes.length === 0) {
      return `Your workspace is empty. You can:\n\n` +
        `• Drag nodes from the left sidebar to build a strategy\n` +
        `• Switch to "Generate" mode and describe your strategy\n` +
        `• Load a template from the Templates menu\n\n` +
        `What kind of strategy would you like to create?`;
    }

    return `I see you have ${currentNodes.length} nodes in your strategy. ${
      currentNodes.length > 0 
        ? `Your strategy includes: ${currentNodes.map(n => n.data.label).join(', ')}.`
        : ''
    }\n\nHow can I help you with your strategy?`;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!open) return null;

  return (
    <div className="w-[400px] bg-[#1e1e1e] border-l border-white/10 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h3 className="font-semibold text-white">AI Strategy Builder</h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white/60"
            onClick={() => onOpenChange(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Mode Toggle */}
        <div className="flex gap-2">
          <Button
            onClick={() => setIsGenerateMode(true)}
            variant={isGenerateMode ? 'default' : 'outline'}
            size="sm"
            className={isGenerateMode ? 'bg-purple-600 hover:bg-purple-700' : 'border-white/20'}
          >
            <Code className="w-4 h-4 mr-2" />
            Generate
          </Button>
          <Button
            onClick={() => setIsGenerateMode(false)}
            variant={!isGenerateMode ? 'default' : 'outline'}
            size="sm"
            className={!isGenerateMode ? 'bg-purple-600 hover:bg-purple-700' : 'border-white/20'}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Chat
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-white/50 py-12">
            <Sparkles className="w-12 h-12 mb-4 text-purple-400/50" />
            {isGenerateMode ? (
              <>
                <p className="text-sm mb-4">Describe your trading strategy in plain English</p>
                <div className="text-xs space-y-2 text-white/40">
                  <p className="italic">"SMA crossover with fast 10 slow 20"</p>
                  <p className="italic">"RSI below 30 buy signal"</p>
                  <p className="italic">"MACD signal line crossover"</p>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm mb-4">Ask me anything about trading strategies</p>
                <div className="text-xs space-y-2 text-white/40">
                  <p className="italic">"What is RSI?"</p>
                  <p className="italic">"How do I backtest my strategy?"</p>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-3 ${
                    msg.role === 'user'
                      ? 'bg-purple-500/20 text-white'
                      : msg.error
                      ? 'bg-red-500/10 border border-red-500/20'
                      : 'bg-[#2a2a2a] text-white'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div className="text-sm prose prose-sm prose-invert max-w-none">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                          li: ({ children }) => <li className="mb-1">{children}</li>,
                          strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
                          code: ({ children }) => <code className="bg-white/10 px-1 py-0.5 rounded text-xs">{children}</code>,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                      
                      {/* Add to Canvas button for generated nodes */}
                      {msg.nodes && msg.nodes.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/10">
                          <Button
                            size="sm"
                            onClick={() => addNodesToCanvas(msg.nodes!, msg.edges || [], false)}
                            className="bg-green-600 hover:bg-green-700 w-full"
                          >
                            <Blocks className="w-4 h-4 mr-2" />
                            Add {msg.nodes.length} Nodes to Canvas
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addNodesToCanvas(msg.nodes!, msg.edges || [], true)}
                            className="w-full mt-2 border-white/20 text-white/70"
                          >
                            Replace Canvas
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-[#2a2a2a] rounded-lg p-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                  <span className="text-sm text-white/60">
                    {isGenerateMode ? 'Generating strategy...' : 'Thinking...'}
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t border-white/10">
        {!isGenerateMode && nodes.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 mb-2 bg-white/5 rounded text-xs text-white/50">
            <Eye className="w-3 h-3" />
            <span>AI can see your workspace ({nodes.length} nodes)</span>
          </div>
        )}
        
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={isGenerateMode ? "Describe your strategy..." : "Ask a question..."}
            disabled={isLoading}
            className="flex-1 bg-[#2a2a2a] border-white/10 text-white placeholder:text-white/40"
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            size="icon"
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AIChatPanel;
