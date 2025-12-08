import { useState, useEffect } from "react";
import { Button, Input, ScrollArea, Card, Switch, Label } from "@/components/ui";
import { Loader2, Send, Sparkles, MessageSquare, Code, Blocks, X, Eye, Zap, Shield, Trash2 } from "lucide-react";
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
  // Load initial state from localStorage
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('aiChatMessages');
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerateMode, setIsGenerateMode] = useState(() => {
    const saved = localStorage.getItem('aiChatGenerateMode');
    return saved ? JSON.parse(saved) : true;
  });
  const [draggedBlockXml, setDraggedBlockXml] = useState<{ xml: string; name: string } | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [workspaceBlockCount, setWorkspaceBlockCount] = useState(0);
  const [pureDeepSeek, setPureDeepSeek] = useState(() => {
    const saved = localStorage.getItem('aiChatPureDeepSeek');
    return saved ? JSON.parse(saved) : false;
  });
  const [validationEnabled, setValidationEnabled] = useState(() => {
    const saved = localStorage.getItem('aiChatValidationEnabled');
    return saved ? JSON.parse(saved) : true;
  });
  const [validationModel, setValidationModel] = useState<"deepseek" | "gemini">(() => {
    const saved = localStorage.getItem('aiChatValidationModel');
    return saved ? JSON.parse(saved) : "deepseek";
  });
  const [aiModel, setAiModel] = useState<"deepseek" | "gemini">("deepseek");
  const { toast } = useToast();

  // Persist messages to localStorage
  useEffect(() => {
    localStorage.setItem('aiChatMessages', JSON.stringify(messages));
  }, [messages]);

  // Persist settings to localStorage
  useEffect(() => {
    localStorage.setItem('aiChatGenerateMode', JSON.stringify(isGenerateMode));
  }, [isGenerateMode]);

  useEffect(() => {
    localStorage.setItem('aiChatPureDeepSeek', JSON.stringify(pureDeepSeek));
  }, [pureDeepSeek]);

  useEffect(() => {
    localStorage.setItem('aiChatValidationEnabled', JSON.stringify(validationEnabled));
  }, [validationEnabled]);

  useEffect(() => {
    localStorage.setItem('aiChatValidationModel', JSON.stringify(validationModel));
  }, [validationModel]);

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
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

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

        let generatedXml: string;
        let aiFixed = false;

        if (pureDeepSeek) {
          // RAG + GCG mode (New Method) - Uses local Python backend with DeepSeek
          const response = await fetch(`${backendUrl}/generate-strategy-rag`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: input,
              existingXml: currentXml,
              blockXml: attachedBlock?.xml || null,
              ai_model: aiModel
            })
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || "Failed to generate strategy");
          }

          const data = await response.json();
          generatedXml = data.xml;
          aiFixed = data.ai_fixed;
          console.log("RAG + GCG generation complete");
        } else {
          // Legacy Mode - Full Context approach
          if (aiModel === "gemini") {
            // Use Supabase Edge Function (Gemini via Lovable Gateway)
            // This matches the original main-test branch behavior
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

            generatedXml = data.xml;
            aiFixed = data.ai_fixed || false;
            console.log("Legacy mode: Supabase Edge Function (Gemini) generation complete");
          } else {
            // Use local Python backend with DeepSeek (Full context mode)
            const response = await fetch(`${backendUrl}/strategy/legacy`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                message: input,
                existingXml: currentXml,
                blockXml: attachedBlock?.xml || null,
                ai_model: "deepseek"
              })
            });

            if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.detail || "Failed to generate strategy");
            }

            const data = await response.json();
            generatedXml = data.xml;
            aiFixed = data.ai_fixed || false;
            console.log("Legacy mode: Local backend (DeepSeek) generation complete");
          }
        }

        // Pass 2: Validate (if enabled)
        let validatedXml = generatedXml;

        if (validationEnabled) {
          try {
            if (validationModel === "gemini") {
              // Use Supabase Edge Function (Gemini)
              const { data, error } = await supabase.functions.invoke('validate-strategy', {
                body: { xml: generatedXml }
              });

              if (!error && data) {
                validatedXml = data.xml;
                aiFixed = data.ai_fixed || aiFixed;
                console.log("Gemini validation complete");
              }
            } else {
              // Use backend (DeepSeek Reasoning)
              const validateResponse = await fetch(`${backendUrl}/validate-strategy`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ xml: generatedXml })
              });

              if (validateResponse.ok) {
                const validateData = await validateResponse.json();
                validatedXml = validateData.xml;
                aiFixed = validateData.ai_fixed || aiFixed;
                console.log("DeepSeek Reasoning validation complete");
              }
            }
          } catch (e) {
            console.log("Validation fallback - using original XML");
          }
        } else {
          console.log("Validation disabled - using generated XML directly");
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
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-pink-500" />
            <h3 className="font-semibold text-foreground">AI Strategy Generator</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => setMessages([])}
            title="Clear Chat"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            <span className="text-xs">Clear</span>
          </Button>
        </div>
        <div className="flex gap-2 mb-3">
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

        {/* LLM Mode and Validation Toggles */}
        {isGenerateMode && (
          <div className="flex items-center gap-3 text-[10px]">
            <div className="flex items-center gap-1" title={pureDeepSeek ? "RAG + GCG (Smart Context)" : "Full Context (Legacy)"}>
              <Switch
                id="pure-deepseek"
                checked={pureDeepSeek}
                onCheckedChange={setPureDeepSeek}
                className="scale-75"
              />
              <Label htmlFor="pure-deepseek" className="cursor-pointer font-normal text-muted-foreground">
                {pureDeepSeek ? "Use RAG (Smart)" : "Use Legacy (Full)"}
              </Label>
            </div>

            {/* AI Model Toggle */}
            <div className="flex items-center gap-1" title={aiModel === "deepseek" ? "Using DeepSeek V3" : "Using Gemini 2.0 Flash"}>
              <Switch
                id="ai-model-toggle"
                checked={aiModel === "deepseek"}
                onCheckedChange={(checked) => setAiModel(checked ? "deepseek" : "gemini")}
                className="scale-75 data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-orange-500"
              />
              <Label htmlFor="ai-model-toggle" className="cursor-pointer font-normal text-muted-foreground">
                {aiModel === "deepseek" ? "DeepSeek" : "Gemini"}
              </Label>
            </div>

            <div className="flex items-center gap-1" title={validationEnabled ? "Validation ON" : "Validation OFF"}>
              <Switch
                id="validation"
                checked={validationEnabled}
                onCheckedChange={setValidationEnabled}
                className="data-[state=checked]:bg-green-500 scale-75"
              />
              <Label htmlFor="validation" className="cursor-pointer text-muted-foreground font-medium">
                V
              </Label>
            </div>
            {validationEnabled && (
              <div className="flex items-center gap-1" title={validationModel === "deepseek" ? "Validation: DeepSeek" : "Validation: Gemini"}>
                <Switch
                  id="validation-model"
                  checked={validationModel === "gemini"}
                  onCheckedChange={(checked) => setValidationModel(checked ? "gemini" : "deepseek")}
                  className="data-[state=checked]:bg-blue-500 scale-75"
                />
                <Label htmlFor="validation-model" className="cursor-pointer text-muted-foreground font-medium">
                  {validationModel === "deepseek" ? "D" : "G"}
                </Label>
              </div>
            )}
          </div>
        )}
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
