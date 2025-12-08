import { useState, useEffect } from "react";
import { Button, Input, ScrollArea, Card } from "@/components/ui";
import { Loader2, Send, Sparkles, MessageSquare, Code, Blocks, X, Eye } from "lucide-react";
import { useToast } from "@/hooks";
import ReactMarkdown from "react-markdown";
import { LogEntry } from "@/components";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  role: "user" | "assistant";
  content: string;
  blockXml?: string;
  blockName?: string;
}

interface AIChatPanelProps {
  onBlocksGenerated: (xml: string, isEdit?: boolean) => void;
  getCurrentWorkspaceXml: () => string | null;
  getSelectedBlocksXml: () => { xml: string; name: string } | null;
  onLog?: (log: LogEntry) => void;
}

export const AIChatPanel = ({ onBlocksGenerated, getCurrentWorkspaceXml, getSelectedBlocksXml, onLog }: AIChatPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerateMode, setIsGenerateMode] = useState(true);
  const [draggedBlockXml, setDraggedBlockXml] = useState<{ xml: string; name: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [workspaceBlockCount, setWorkspaceBlockCount] = useState(0);
  const { toast } = useToast();

  // Listen for block drop events from workspace
  useEffect(() => {
    const handleAddBlock = (e: any) => {
      const blockData = e.detail;
      if (blockData) {
        setDraggedBlockXml(blockData);
      }
    };

    window.addEventListener('addBlockToChat', handleAddBlock);
    return () => window.removeEventListener('addBlockToChat', handleAddBlock);
  }, []);

  // Update workspace block count
  useEffect(() => {
    const xml = getCurrentWorkspaceXml();
    const count = xml ? (xml.match(/<block /g) || []).length : 0;
    setWorkspaceBlockCount(count);
  }, [getCurrentWorkspaceXml]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const blockData = e.dataTransfer.getData('blockly/xml');
    if (blockData) {
      try {
        const parsed = JSON.parse(blockData);
        setDraggedBlockXml(parsed);
        toast({
          title: "Block Attached",
          description: `${parsed.name} block attached to message`,
        });
      } catch (error) {
        console.error("Failed to parse block data:", error);
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: "user",
      content: input,
      blockXml: draggedBlockXml?.xml,
      blockName: draggedBlockXml?.name
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    const attachedBlock = draggedBlockXml;
    setDraggedBlockXml(null);
    setIsLoading(true);

    const startTime = Date.now();

    try {
      if (isGenerateMode) {
        // Generate mode - create blocks
        const currentXml = getCurrentWorkspaceXml();
        const blockCount = currentXml ? (currentXml.match(/<block /g) || []).length : 0;

        // Log request
        if (onLog) {
          onLog({
            type: 'request',
            mode: 'generate',
            message: input,
            workspaceBlocks: blockCount,
            workspaceSize: currentXml ? (currentXml.length / 1024).toFixed(2) : '0',
            hasAttachedBlock: !!attachedBlock,
            timestamp: Date.now()
          });
        }

        // Use Supabase Edge Function for strategy generation
        const { data, error } = await supabase.functions.invoke('generate-strategy', {
          body: {
            message: input,
            currentWorkspace: currentXml,
            blockXml: attachedBlock?.xml || null
          }
        });

        if (error) {
          if (onLog) {
            onLog({
              type: 'error',
              mode: 'generate',
              error: error.message || 'Failed to generate strategy',
              timestamp: Date.now()
            });
          }
          throw new Error(error.message || "Failed to generate strategy");
        }

        // Pass 2: Validate with DeepSeek Reasoning
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
        let validatedXml = data.xml;
        let aiFixed = false;

        try {
          const validateResponse = await fetch(`${backendUrl}/validate-strategy`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ xml: data.xml })
          });

          if (validateResponse.ok) {
            const validateData = await validateResponse.json();
            validatedXml = validateData.xml;
            aiFixed = validateData.ai_fixed;
            console.log("DeepSeek Reasoning validation complete");
          }
        } catch (e) {
          console.log("Validation fallback - using original XML");
        }

        if (onLog) {
          onLog({
            type: 'response',
            mode: 'generate',
            success: true,
            duration: Date.now() - startTime,
            timestamp: Date.now()
          });
        }

        const isEdit = currentXml !== null;
        const assistantMessage: Message = {
          role: "assistant",
          content: isEdit
            ? "Strategy updated successfully! Replacing workspace..."
            : "Strategy blocks generated successfully! Adding to workspace...",
        };
        setMessages((prev) => [...prev, assistantMessage]);

        try {
          onBlocksGenerated(validatedXml, isEdit);

          // Check if AI had to auto-fix indicator parameters
          if (aiFixed) {
            toast({
              title: "⚠️ AI Parameter Issue Detected",
              description: "Identical indicators were automatically corrected to use Fast/Slow periods.",
            });
          }

          toast({
            title: "Strategy Generated",
            description: "Your trading blocks have been added to the workspace.",
          });
        } catch (error) {
          // Log the failure
          if (onLog) {
            onLog({
              type: 'error',
              mode: 'generate',
              error: error instanceof Error ? error.message : 'Failed to load blocks',
              timestamp: Date.now()
            });
          }
          throw error;
        }
      } else {
        // Conversational mode - Get workspace for context
        const currentXml = getCurrentWorkspaceXml();
        const blockCount = currentXml ? (currentXml.match(/<block /g) || []).length : 0;

        // Log request
        if (onLog) {
          onLog({
            type: 'request',
            mode: 'chat',
            message: input,
            workspaceBlocks: blockCount,
            workspaceSize: currentXml ? (currentXml.length / 1024).toFixed(2) : '0',
            hasAttachedBlock: !!attachedBlock,
            timestamp: Date.now()
          });
        }

        // Use local Python backend for chat (fallback to Supabase if not implemented)
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
        const response = await fetch(
          `${backendUrl}/chat`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messages: [...messages, userMessage],
              blockXml: attachedBlock?.xml,
              currentWorkspace: currentXml
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          if (onLog) {
            onLog({
              type: 'error',
              mode: 'chat',
              error: errorData.error || 'Failed to get response',
              timestamp: Date.now()
            });
          }
          throw new Error(errorData.error || "Failed to get response");
        }

        const data = await response.json();

        if (onLog) {
          onLog({
            type: 'response',
            mode: 'chat',
            success: true,
            duration: Date.now() - startTime,
            timestamp: Date.now()
          });
        }

        const assistantMessage: Message = {
          role: "assistant",
          content: data.response,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error("Error:", error);
      if (onLog) {
        onLog({
          type: 'error',
          mode: isGenerateMode ? 'generate' : 'chat',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now()
        });
      }

      const errorMessage: Message = {
        role: "assistant",
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"
          }`,
      };
      setMessages((prev) => [...prev, errorMessage]);

      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process request",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="flex flex-col h-full bg-background/95 backdrop-blur border-border">
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-pink-500" />
          <h3 className="font-semibold text-foreground">AI Strategy Generator</h3>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => setIsGenerateMode(true)}
            variant={isGenerateMode ? "default" : "outline"}
            size="sm"
            className={isGenerateMode ? "bg-pink-500 hover:bg-pink-600 text-white" : ""}
          >
            <Code className="w-4 h-4 mr-2" />
            Generate Blocks
          </Button>
          <Button
            onClick={() => setIsGenerateMode(false)}
            variant={!isGenerateMode ? "default" : "outline"}
            size="sm"
            className={!isGenerateMode ? "bg-pink-500 hover:bg-pink-600 text-white" : ""}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Chat Only
          </Button>
        </div>
      </div>

      <ScrollArea
        className={`flex-1 p-4 transition-colors ${isDragOver ? 'bg-pink-500/10 border-2 border-pink-500 border-dashed' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-6">
            <Sparkles className="w-12 h-12 mb-4 text-pink-500/50" />
            {isGenerateMode ? (
              <>
                <p className="text-sm mb-4">Describe your trading strategy in plain English</p>
                <div className="text-xs space-y-2">
                  <p className="italic">"Buy when price crosses above 20-day SMA"</p>
                  <p className="italic">"RSI strategy - long below 30, close above 70"</p>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm mb-4">Ask me anything about trading strategies</p>
                <div className="text-xs space-y-2">
                  <p className="italic">"What is RSI and how do I use it?"</p>
                  <p className="italic">"Explain moving average crossover strategies"</p>
                </div>
              </>
            )}
            <p className="text-xs mt-4 text-pink-500/50">
              💡 Drag blocks from workspace to ask about them
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${msg.role === "user"
                    ? "bg-pink-500/20 text-foreground"
                    : "bg-muted text-foreground"
                    }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown
                        components={{
                          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                          ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                          ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
                          li: ({ children }) => <li className="mb-1">{children}</li>,
                          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                          em: ({ children }) => <em className="italic">{children}</em>,
                          code: ({ children }) => <code className="bg-background/50 px-1 py-0.5 rounded text-xs">{children}</code>,
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      {msg.blockXml && msg.blockName && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-pink-500/80">
                          <Blocks className="w-3 h-3" />
                          <span>Block: {msg.blockName}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-lg p-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-pink-500" />
                  <p className="text-sm text-muted-foreground">
                    {isGenerateMode ? "Generating your strategy..." : "Thinking..."}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <div className="p-4 border-t border-border">
        {!isGenerateMode && (
          <div className="flex items-center gap-2 px-3 py-1.5 mb-2 bg-muted/30 rounded-md text-xs text-muted-foreground">
            <Eye className="w-3 h-3" />
            <span>AI can see your workspace ({workspaceBlockCount} blocks)</span>
          </div>
        )}

        {draggedBlockXml && (
          <div className="mb-2 p-2 bg-pink-500/10 border border-pink-500/20 rounded flex items-center gap-2">
            <Blocks className="w-4 h-4 text-pink-500" />
            <span className="text-xs flex-1">Block attached: {draggedBlockXml.name}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setDraggedBlockXml(null)}
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Describe your trading strategy..."
            disabled={isLoading}
            className="flex-1 bg-background border-border"
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            size="icon"
            className="bg-pink-500 hover:bg-pink-600"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
};
