/**
 * AI Chat Page - Global AI Assistant for Fyer.
 *
 * Single full-page conversational AI with tool-calling:
 * - Strategy building (streams nodes onto canvas)
 * - Backtesting, Monte Carlo analysis
 * - Portfolio & execution queries
 * - Navigation guidance
 * - Trading education
 */

import { useState, useRef, useEffect, useCallback, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Bot,
  User,
  Sparkles,
  TrendingUp,
  BarChart3,
  ShieldCheck,
  Lightbulb,
  Loader2,
  Blocks,
  ChevronRight,
  Wrench,
  Check,
  AlertCircle,
  Trash2,
  ArrowRight,
  FlaskConical,
  BarChart,
  Newspaper,
  Briefcase,
  Dice5,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { api, type AiChatEvent } from '@/services/api';
import { useAiChatStore, type ChatMessage, type ToolCallEvent } from '@/stores/aiChatStore';
import { useStrategyFlowStore } from '@/features/strategy-flow/store/strategyFlowStore';

// ── Suggestion cards ─────────────────────────────────────────

const SUGGESTIONS = [
  {
    icon: <Blocks className="w-4 h-4" />,
    text: 'Build an RSI oversold buy strategy for me',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10 border-pink-500/20',
  },
  {
    icon: <Dice5 className="w-4 h-4" />,
    text: 'Run a Monte Carlo analysis on SPY for 2024',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20',
  },
  {
    icon: <TrendingUp className="w-4 h-4" />,
    text: 'Create a MACD crossover strategy with stop-loss',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
  },
  {
    icon: <BarChart3 className="w-4 h-4" />,
    text: 'Compare SMA vs EMA crossover approaches',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
  },
  {
    icon: <Briefcase className="w-4 h-4" />,
    text: 'Show me my portfolio summary',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
  },
  {
    icon: <Lightbulb className="w-4 h-4" />,
    text: 'Explain the Kelly criterion for position sizing',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10 border-cyan-500/20',
  },
];

// ── Tool display helpers ─────────────────────────────────────

const TOOL_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  build_strategy: { label: 'Building Strategy', icon: <Blocks className="w-3.5 h-3.5" />, color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
  run_backtest: { label: 'Running Backtest', icon: <BarChart className="w-3.5 h-3.5" />, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  run_monte_carlo: { label: 'Monte Carlo Test', icon: <Dice5 className="w-3.5 h-3.5" />, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  navigate_to_page: { label: 'Navigating', icon: <ArrowRight className="w-3.5 h-3.5" />, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  get_portfolio_summary: { label: 'Fetching Portfolio', icon: <Briefcase className="w-3.5 h-3.5" />, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  list_user_strategies: { label: 'Loading Strategies', icon: <Blocks className="w-3.5 h-3.5" />, color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' },
  get_execution_history: { label: 'Fetching Executions', icon: <BarChart3 className="w-3.5 h-3.5" />, color: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
  get_market_news: { label: 'Fetching News', icon: <Newspaper className="w-3.5 h-3.5" />, color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
  analyze_strategy: { label: 'Analyzing Strategy', icon: <FlaskConical className="w-3.5 h-3.5" />, color: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
  explain_trading_concept: { label: 'Explaining', icon: <Lightbulb className="w-3.5 h-3.5" />, color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' },
};

// ── Tool Call Card Component ─────────────────────────────────

const ToolCallCard = ({ tc }: { tc: ToolCallEvent }) => {
  const meta = TOOL_META[tc.tool] || { label: tc.tool, icon: <Wrench className="w-3.5 h-3.5" />, color: 'text-gray-400 bg-gray-500/10 border-gray-500/20' };
  const isDone = tc.status === 'done';
  const isError = tc.status === 'error';

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${meta.color} ${isError ? 'border-red-500/30 bg-red-500/5' : ''}`}
    >
      {isDone ? (
        <Check className="w-3.5 h-3.5 text-green-400" />
      ) : isError ? (
        <AlertCircle className="w-3.5 h-3.5 text-red-400" />
      ) : (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      )}
      <span className="font-medium">{meta.label}</span>
      {tc.args?.description && (
        <span className="text-white/40 truncate max-w-[200px]">
          — {tc.args.description}
        </span>
      )}
      {tc.args?.symbol && (
        <span className="text-white/40">{tc.args.symbol}</span>
      )}
    </motion.div>
  );
};

// ── Strategy Nodes Preview ───────────────────────────────────

const StrategyNodesPreview = ({
  nodes,
  edges,
  onAddToCanvas,
}: {
  nodes: any[];
  edges: any[];
  onAddToCanvas: (nodes: any[], edges: any[], replace: boolean) => void;
}) => {
  if (!nodes || nodes.length === 0) return null;

  const nodeTypeCounts: Record<string, number> = {};
  for (const n of nodes) {
    const t = n.type || 'unknown';
    nodeTypeCounts[t] = (nodeTypeCounts[t] || 0) + 1;
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mt-2 rounded-lg border border-pink-500/20 bg-pink-500/5 overflow-hidden"
    >
      <div className="px-3 py-2 border-b border-pink-500/10 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-pink-300">
          <Blocks className="w-3.5 h-3.5" />
          <span className="font-medium">{nodes.length} Nodes Generated</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-white/40">
          {Object.entries(nodeTypeCounts).map(([type, count]) => (
            <span
              key={type}
              className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10"
            >
              {type} x{count}
            </span>
          ))}
        </div>
      </div>

      {/* Mini node list */}
      <div className="px-3 py-2 max-h-[120px] overflow-y-auto">
        <div className="flex flex-wrap gap-1.5">
          {nodes.map((node: any, i: number) => (
            <motion.div
              key={node.id || i}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] text-white/60"
            >
              {node.data?.label || node.type || 'Node'}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div className="px-3 py-2 border-t border-pink-500/10 flex gap-2">
        <Button
          size="sm"
          onClick={() => onAddToCanvas(nodes, edges, false)}
          className="flex-1 h-7 text-xs bg-pink-600 hover:bg-pink-700 text-white font-medium"
        >
          <Blocks className="w-3 h-3 mr-1" />
          Add to Canvas
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAddToCanvas(nodes, edges, true)}
          className="h-7 text-xs border-pink-500/30 text-pink-300 hover:bg-pink-500/10"
        >
          Replace Canvas
        </Button>
      </div>
    </motion.div>
  );
};

// ── Navigation Action Button ─────────────────────────────────

const NavigationAction = ({
  route,
  page,
  reason,
  onNavigate,
}: {
  route: string;
  page: string;
  reason?: string;
  onNavigate: (route: string) => void;
}) => (
  <motion.button
    initial={{ opacity: 0, y: 4 }}
    animate={{ opacity: 1, y: 0 }}
    onClick={() => onNavigate(route)}
    className="flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-500/20 bg-blue-500/5 text-xs text-blue-300 hover:bg-blue-500/10 transition-colors mt-1"
  >
    <ExternalLink className="w-3.5 h-3.5" />
    <span>Go to {page}</span>
    {reason && <span className="text-white/30">— {reason}</span>}
    <ChevronRight className="w-3 h-3 ml-auto" />
  </motion.button>
);

// ── Message Bubble Component ─────────────────────────────────

const MessageBubble = ({
  msg,
  onAddToCanvas,
  onNavigate,
}: {
  msg: ChatMessage;
  onAddToCanvas: (nodes: any[], edges: any[], replace: boolean) => void;
  onNavigate: (route: string) => void;
}) => {
  const isUser = msg.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-3 py-3 px-2 ${isUser ? 'justify-end' : ''}`}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20 flex items-center justify-center mt-0.5">
          <Sparkles className="w-4 h-4 text-purple-400" />
        </div>
      )}

      <div className={`max-w-[80%] min-w-0 ${isUser ? '' : 'flex-1'}`}>
        {/* User message */}
        {isUser ? (
          <div className="rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed bg-primary/20 text-foreground border border-primary/10">
            {msg.content}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Tool calls */}
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="space-y-1.5">
                {msg.toolCalls.map((tc, i) => (
                  <ToolCallCard key={`${tc.tool}-${i}`} tc={tc} />
                ))}
              </div>
            )}

            {/* Strategy nodes preview */}
            {msg.strategyNodes && msg.strategyNodes.length > 0 && (
              <StrategyNodesPreview
                nodes={msg.strategyNodes}
                edges={msg.strategyEdges || []}
                onAddToCanvas={onAddToCanvas}
              />
            )}

            {/* Navigation actions */}
            {msg.actions?.map((act, i) =>
              act.action === 'navigate' ? (
                <NavigationAction
                  key={i}
                  route={act.data.route}
                  page={act.data.page}
                  reason={act.data.reason}
                  onNavigate={onNavigate}
                />
              ) : null
            )}

            {/* Text content */}
            {msg.content && (
              <div className="rounded-2xl rounded-bl-md px-4 py-2.5 bg-white/[0.03] text-foreground/90 border border-white/[0.06]">
                <div className="text-sm prose prose-sm prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mb-2 [&>ol]:mb-2 [&_li]:mb-0.5 [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-pink-300 [&_code]:text-xs [&_pre]:bg-black/30 [&_pre]:rounded-lg [&_pre]:p-3 [&_pre]:border [&_pre]:border-white/10 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-emerald-300 [&_pre_code]:text-[11px] [&_strong]:text-foreground">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Streaming cursor */}
            {msg.isStreaming && !msg.content && (!msg.toolCalls || msg.toolCalls.length === 0) && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-2xl rounded-bl-md bg-white/[0.03] border border-white/[0.06]">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                <span className="text-xs text-muted-foreground">Thinking...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center mt-0.5">
          <User className="w-4 h-4 text-white/60" />
        </div>
      )}
    </motion.div>
  );
};

// ── Main AiChat Component ────────────────────────────────────

const AiChat = () => {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<{ cancel: () => void } | null>(null);

  const {
    messages,
    isStreaming,
    addUserMessage,
    addAssistantMessage,
    appendToMessage,
    addToolCall,
    updateToolCall,
    addAction,
    addStrategyNode,
    setStrategyEdges,
    finalizeMessage,
    clearMessages,
  } = useAiChatStore();

  const { setNodes, setEdges } = useStrategyFlowStore();

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  // Focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Add strategy nodes to canvas
  const handleAddToCanvas = useCallback(
    (newNodes: any[], newEdges: any[], replace: boolean) => {
      const store = useStrategyFlowStore.getState();
      if (replace) {
        setNodes(newNodes);
        setEdges(newEdges);
        toast.success(`Replaced canvas with ${newNodes.length} nodes`);
      } else {
        const existingNodes = store.nodes;
        const existingEdges = store.edges;
        const maxX = existingNodes.reduce((max, n) => Math.max(max, n.position.x), 0);
        const offsetX = maxX > 0 ? maxX + 300 : 0;

        const offsetNodes = newNodes.map((node: any) => ({
          ...node,
          id: `${node.id}-${Date.now()}`,
          position: { x: node.position.x + offsetX, y: node.position.y },
        }));

        const idMap = new Map(newNodes.map((n: any, i: number) => [n.id, offsetNodes[i].id]));
        const offsetEdges = newEdges.map((edge: any) => ({
          ...edge,
          id: `${edge.id}-${Date.now()}`,
          source: idMap.get(edge.source) || edge.source,
          target: idMap.get(edge.target) || edge.target,
        }));

        setNodes([...existingNodes, ...offsetNodes]);
        setEdges([...existingEdges, ...offsetEdges]);
        toast.success(`Added ${newNodes.length} nodes to canvas`);
      }
      toast('Switch to Builder to see your strategy', {
        action: { label: 'Go to Builder', onClick: () => navigate('/') },
      });
    },
    [setNodes, setEdges, navigate]
  );

  const handleNavigate = useCallback(
    (route: string) => {
      navigate(route);
    },
    [navigate]
  );

  // ── Send message ───────────────────────────────────────────

  const handleSend = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim();
      if (!content || isStreaming) return;

      setInput('');
      addUserMessage(content);
      const assistantId = addAssistantMessage();

      // Build history for the API (last 20 messages)
      const history = messages.slice(-20).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const { cancel } = api.streamAiChat(
        content,
        history,
        undefined,
        (event: AiChatEvent) => {
          switch (event.type) {
            case 'text_delta':
              appendToMessage(assistantId, event.content);
              break;

            case 'tool_call':
              addToolCall(assistantId, {
                tool: event.tool,
                args: event.args,
                status: 'calling',
              });
              break;

            case 'tool_result':
              updateToolCall(assistantId, event.tool, {
                status: event.result?.success === false ? 'error' : 'done',
                result: event.result,
              });
              break;

            case 'strategy_node':
              addStrategyNode(assistantId, event.node);
              break;

            case 'strategy_edges':
              setStrategyEdges(assistantId, event.edges);
              break;

            case 'action':
              addAction(assistantId, { action: event.action, data: event.data });
              // Auto-navigate if requested
              if (event.action === 'navigate' && event.data.route) {
                // Don't auto-navigate, let the user click
              }
              break;

            case 'done':
              finalizeMessage(assistantId);
              break;

            case 'error':
              appendToMessage(assistantId, `\n\n*Error: ${event.message}*`);
              finalizeMessage(assistantId);
              break;
          }
        }
      );

      abortRef.current = { cancel };
    },
    [
      input,
      isStreaming,
      messages,
      addUserMessage,
      addAssistantMessage,
      appendToMessage,
      addToolCall,
      updateToolCall,
      addAction,
      addStrategyNode,
      setStrategyEdges,
      finalizeMessage,
    ]
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSend();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center pt-20 pb-4 px-4">
      <div className="w-full max-w-3xl flex flex-col flex-1 min-h-0">
        {/* ── Empty State ─────────────────────────────────── */}
        {isEmpty && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col items-center justify-center gap-6 select-none"
          >
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/20 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-purple-400" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-background" />
            </div>

            <div className="text-center space-y-2">
              <h1 className="text-xl font-semibold text-foreground">
                Fyer AI Assistant
              </h1>
              <p className="text-sm text-muted-foreground max-w-md">
                I can build strategies, run backtests, perform Monte Carlo
                analysis, manage your portfolio, and guide you through
                everything in the platform.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg mt-2">
              {SUGGESTIONS.map((s, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  onClick={() => handleSend(s.text)}
                  className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border ${s.bg} text-left text-sm text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-[1.02]`}
                >
                  <span className={s.color}>{s.icon}</span>
                  <span className="line-clamp-2 text-xs">{s.text}</span>
                </motion.button>
              ))}
            </div>

            {/* Capability pills */}
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {[
                'Strategy Builder',
                'Backtesting',
                'Monte Carlo',
                'Portfolio',
                'Market News',
                'Risk Analysis',
                'Code Export',
                'Education',
              ].map((cap) => (
                <span
                  key={cap}
                  className="px-2.5 py-1 rounded-full text-[10px] font-medium text-white/30 border border-white/[0.06] bg-white/[0.02]"
                >
                  {cap}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Messages ────────────────────────────────────── */}
        {!isEmpty && (
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto pb-4 scrollbar-thin"
          >
            {/* Clear button */}
            <div className="flex justify-end px-2 py-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearMessages}
                className="h-6 text-[10px] text-muted-foreground hover:text-foreground gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Clear
              </Button>
            </div>

            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  onAddToCanvas={handleAddToCanvas}
                  onNavigate={handleNavigate}
                />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* ── Input Area ──────────────────────────────────── */}
        <div className="sticky bottom-0 pt-2">
          <form
            onSubmit={handleSubmit}
            className="relative flex items-end gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm px-4 py-3 focus-within:border-purple-500/40 transition-colors shadow-lg shadow-black/20"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask me to build a strategy, run analysis, or anything else..."
              rows={1}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none max-h-40 leading-relaxed"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isStreaming}
              className="h-8 w-8 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            >
              {isStreaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </form>
          <p className="text-center text-[11px] text-muted-foreground/50 mt-2">
            AI can call tools and build strategies. Responses are for
            informational purposes — not financial advice.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AiChat;
