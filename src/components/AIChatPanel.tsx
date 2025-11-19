import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Loader2, Send, Sparkles, MessageSquare, Code, Blocks, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";

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
}

export const AIChatPanel = ({ onBlocksGenerated, getCurrentWorkspaceXml, getSelectedBlocksXml }: AIChatPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerateMode, setIsGenerateMode] = useState(true);
  const [draggedBlockXml, setDraggedBlockXml] = useState<{ xml: string; name: string } | null>(null);
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

    try {
      if (isGenerateMode) {
        // Generate mode - create blocks
        const currentXml = getCurrentWorkspaceXml();
        
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-strategy`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ 
              message: input,
              currentWorkspace: currentXml,
              blockXml: attachedBlock?.xml
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to generate strategy");
        }

        const data = await response.json();
        
        const isEdit = currentXml !== null;
        const assistantMessage: Message = {
          role: "assistant",
          content: isEdit 
            ? "Strategy updated successfully! Replacing workspace..."
            : "Strategy blocks generated successfully! Adding to workspace...",
        };
        setMessages((prev) => [...prev, assistantMessage]);

        onBlocksGenerated(data.xml, isEdit);

        toast({
          title: "Strategy Generated",
          description: "Your trading blocks have been added to the workspace.",
        });
      } else {
        // Conversational mode - just chat
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/conversational-chat`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ 
              messages: [...messages, userMessage],
              blockXml: attachedBlock?.xml
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to get response");
        }

        const data = await response.json();
        
        const assistantMessage: Message = {
          role: "assistant",
          content: data.response,
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }
    } catch (error) {
      console.error("Error:", error);
      
      const errorMessage: Message = {
        role: "assistant",
        content: `Sorry, I encountered an error: ${
          error instanceof Error ? error.message : "Unknown error"
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

      <ScrollArea className="flex-1 p-4">
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
                  className={`max-w-[80%] rounded-lg p-3 ${
                    msg.role === "user"
                      ? "bg-pink-500/20 text-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="text-sm prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown
                        components={{
                          p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                          ul: ({children}) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
                          ol: ({children}) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
                          li: ({children}) => <li className="mb-1">{children}</li>,
                          strong: ({children}) => <strong className="font-semibold">{children}</strong>,
                          em: ({children}) => <em className="italic">{children}</em>,
                          code: ({children}) => <code className="bg-background/50 px-1 py-0.5 rounded text-xs">{children}</code>,
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
