/**
 * AI Chat Page – Conversational trading assistant.
 */

import { useState, useRef, useEffect, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Bot,
  User,
  Sparkles,
  TrendingUp,
  BarChart3,
  ShieldCheck,
  Lightbulb,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SUGGESTIONS = [
  { icon: <TrendingUp className="w-4 h-4" />, text: 'Analyze my portfolio risk exposure' },
  { icon: <BarChart3 className="w-4 h-4" />, text: 'Compare SMA vs EMA crossover strategies' },
  { icon: <ShieldCheck className="w-4 h-4" />, text: 'Review my stop-loss configuration' },
  { icon: <Lightbulb className="w-4 h-4" />, text: 'Suggest a momentum strategy for SPX' },
];

const MOCK_RESPONSES: Record<string, string> = {
  fallback:
    "I'm your trading assistant. I can help you analyze strategies, review portfolio risk, interpret market data, and optimize your trading configurations. What would you like to explore?",
};

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

const AiChat = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content) return;

    const userMsg: Message = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Simulate assistant response
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));

    const assistantMsg: Message = {
      id: generateId(),
      role: 'assistant',
      content: MOCK_RESPONSES.fallback,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, assistantMsg]);
    setIsTyping(false);
  };

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

  const isEmpty = messages.length === 0;

  return (
    <div className="min-h-screen bg-background flex flex-col items-center pt-20 pb-4 px-4">
      <div className="w-full max-w-3xl flex flex-col flex-1 min-h-0">

        {/* Empty state */}
        {isEmpty && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col items-center justify-center gap-6 select-none"
          >
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/20 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-background" />
            </div>

            <div className="text-center space-y-2">
              <h1 className="text-xl font-semibold text-foreground">Trading Assistant</h1>
              <p className="text-sm text-muted-foreground max-w-md">
                Ask about strategies, market analysis, risk management, or anything related to your trading workflow.
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
                  className="flex items-center gap-2.5 px-4 py-3 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06] hover:border-primary/30 text-left text-sm text-muted-foreground hover:text-foreground transition-all duration-200"
                >
                  <span className="text-primary/70">{s.icon}</span>
                  <span className="line-clamp-1">{s.text}</span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* Messages */}
        {!isEmpty && (
          <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-1 pb-4 scrollbar-thin">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex gap-3 py-4 px-2 ${msg.role === 'assistant' ? '' : 'justify-end'}`}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center mt-0.5">
                      <Bot className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-primary/20 text-foreground rounded-br-md'
                        : 'bg-white/[0.04] text-foreground/90 border border-white/[0.06] rounded-bl-md'
                    }`}
                  >
                    {msg.content}
                  </div>
                  {msg.role === 'user' && (
                    <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center mt-0.5">
                      <User className="w-4 h-4 text-white/60" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing indicator */}
            {isTyping && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-3 py-4 px-2"
              >
                <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse" />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse [animation-delay:0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse [animation-delay:0.3s]" />
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Input area */}
        <div className="sticky bottom-0 pt-2">
          <form
            onSubmit={handleSubmit}
            className="relative flex items-end gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.03] backdrop-blur-sm px-4 py-3 focus-within:border-primary/40 transition-colors"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about strategies, risk, market analysis…"
              rows={1}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none max-h-32 leading-relaxed"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isTyping}
              className="h-8 w-8 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
          <p className="text-center text-[11px] text-muted-foreground/50 mt-2">
            AI responses are for informational purposes only — not financial advice.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AiChat;
