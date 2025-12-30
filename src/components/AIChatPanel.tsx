import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Loader2, Send, Sparkles, MessageSquare, Code, Blocks, X, Eye, Zap, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { LogEntry } from "./DevLogPanel";

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
    onClose?: () => void;
}

interface GenerationProgress {
    phase: string;
    message: string;
    step: number;
    totalSteps: number;
    blocksGenerated?: number;
}

// AIChatPanel component
export const AIChatPanel = ({ onBlocksGenerated, getCurrentWorkspaceXml, getSelectedBlocksXml, onLog, onClose }: AIChatPanelProps) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isGenerateMode, setIsGenerateMode] = useState(true);
    const [draggedBlockXml, setDraggedBlockXml] = useState<{ xml: string; name: string } | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);
    const [workspaceBlockCount, setWorkspaceBlockCount] = useState(0);
    const [slowMode, setSlowMode] = useState(false);
    const [generationProgress, setGenerationProgress] = useState<GenerationProgress | null>(null);
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
                    title: "Block attached",
                    description: `${parsed.name} added to message context`,
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

                // Start progress simulation
                const totalSteps = slowMode ? 5 : 4;

                setGenerationProgress({
                    phase: 'analyzing',
                    message: 'Analyzing request',
                    step: 1,
                    totalSteps
                });

                // Step 2: Building strategy
                const progressTimer1 = setTimeout(() => {
                    setGenerationProgress({
                        phase: 'generating',
                        message: 'Building strategy blocks',
                        step: 2,
                        totalSteps
                    });
                }, 1000);

                // Step 3: Validating
                const progressTimer2 = setTimeout(() => {
                    setGenerationProgress({
                        phase: 'validating',
                        message: 'Validating structure',
                        step: 3,
                        totalSteps
                    });
                }, slowMode ? 8000 : 4000);

                // Step 4: Rationalizing (slow mode only)
                const progressTimer3 = slowMode ? setTimeout(() => {
                    setGenerationProgress({
                        phase: 'rationalizing',
                        message: 'Optimizing strategy logic',
                        step: 4,
                        totalSteps
                    });
                }, 15000) : null;

                const response = await fetch(
                    `http://localhost:8000/generate-strategy`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            message: input,
                            currentWorkspace: currentXml,
                            blockXml: attachedBlock?.xml,
                            mode: slowMode ? 'slow' : 'fast'
                        }),
                    }
                );

                // Clear progress timers
                clearTimeout(progressTimer1);
                clearTimeout(progressTimer2);
                if (progressTimer3) clearTimeout(progressTimer3);

                const totalStepsForComplete = slowMode ? 5 : 4;

                // Final step: Finalizing
                setGenerationProgress({
                    phase: 'finalizing',
                    message: 'Finalizing strategy',
                    step: totalStepsForComplete,
                    totalSteps: totalStepsForComplete
                });

                if (!response.ok) {
                    const errorData = await response.json();
                    if (onLog) {
                        onLog({
                            type: 'error',
                            mode: 'generate',
                            error: errorData.error || 'Failed to generate strategy',
                            timestamp: Date.now()
                        });
                    }
                    throw new Error(errorData.error || "Failed to generate strategy");
                }

                const data = await response.json();

                // Show blocks generated count
                const generatedBlockCount = data.xml ? (data.xml.match(/<block /g) || []).length : 0;
                const wasRationalized = data.wasRationalized || false;

                setGenerationProgress({
                    phase: 'complete',
                    message: wasRationalized ? 'Strategy optimized' : 'Strategy complete',
                    step: totalStepsForComplete,
                    totalSteps: totalStepsForComplete,
                    blocksGenerated: generatedBlockCount
                });

                await new Promise(resolve => setTimeout(resolve, 500));
                setGenerationProgress(null);

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
                const rationalizationNote = data.wasRationalized ? " (optimized)" : "";
                const assistantMessage: Message = {
                    role: "assistant",
                    content: isEdit
                        ? `Strategy updated${rationalizationNote}. Replacing workspace.`
                        : `Strategy generated${rationalizationNote}. Adding to workspace.`,
                };
                setMessages((prev) => [...prev, assistantMessage]);

                try {
                    onBlocksGenerated(data.xml, isEdit);

                    // Check if AI had to auto-fix indicator parameters
                    if (data.autoFixed) {
                        toast({
                            title: "Parameters adjusted",
                            description: "Identical indicators corrected to use distinct periods.",
                        });
                    }

                    toast({
                        title: "Strategy generated",
                        description: `${generatedBlockCount} blocks added to workspace.`,
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

                const response = await fetch(
                    `http://localhost:8000/agent/chat`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            message: input,
                            current_workspace: currentXml,
                            session_id: undefined // Let backend create new session
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
            setGenerationProgress(null);
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
            setGenerationProgress(null);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="w-80 bg-card border-l border-border flex flex-col overflow-hidden animate-fade-in h-full">
            {/* Header */}
            <div className="px-3 py-2 border-b border-border">
                <div className="flex items-center justify-between mb-3 gap-2">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-pink-500" />
                        <h2 className="font-semibold text-foreground text-sm">AI Assistant</h2>
                    </div>
                    {onClose && (
                        <Button onClick={onClose} variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10">
                            <X className="w-4 h-4" />
                        </Button>
                    )}
                </div>

                {/* Mode Selector */}
                <div className="flex gap-2">
                    <Button
                        variant={isGenerateMode ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setIsGenerateMode(true)}
                        className="flex-1"
                    >
                        <Code className="w-4 h-4 mr-2" />
                        Generate
                    </Button>
                    <Button
                        variant={!isGenerateMode ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setIsGenerateMode(false)}
                        className="flex-1"
                    >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Chat
                    </Button>
                </div>

                {/* Mode Toggle: Fast vs Slow (Precise) */}
                {isGenerateMode && (
                    <div className="flex items-center gap-4 text-xs mt-2">
                        <div className="flex items-center gap-2">
                            <Switch
                                id="slow-mode"
                                checked={slowMode}
                                onCheckedChange={setSlowMode}
                                className="data-[state=checked]:bg-amber-500"
                            />
                            <Label htmlFor="slow-mode" className="flex items-center gap-1 cursor-pointer text-muted-foreground">
                                <Zap className={`w-3 h-3 ${slowMode ? 'text-amber-500' : 'text-green-500'}`} />
                                {slowMode ? "Precise (slower)" : "Fast"}
                            </Label>
                        </div>
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
                                <p className="text-sm mb-4">Describe your trading strategy in plain language</p>
                                <div className="text-xs space-y-2">
                                    <p className="italic">"Buy when price crosses above 20-day SMA"</p>
                                    <p className="italic">"RSI strategy - long below 30, close above 70"</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="text-sm mb-4">Ask questions about trading strategies</p>
                                <div className="text-xs space-y-2">
                                    <p className="italic">"What is RSI and how do I use it?"</p>
                                    <p className="italic">"Explain moving average crossover strategies"</p>
                                </div>
                            </>
                        )}
                        <p className="text-xs mt-4 text-pink-500/50">
                            Drag blocks from workspace for context
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
                                <div className="bg-muted rounded-lg p-4 min-w-[250px]">
                                    {isGenerateMode && generationProgress ? (
                                        <div className="space-y-3">
                                            {/* Progress header */}
                                            <div className="flex items-center gap-2">
                                                <Loader2 className="w-4 h-4 animate-spin text-pink-500" />
                                                <p className="text-sm font-medium text-foreground">
                                                    {generationProgress.message}
                                                </p>
                                            </div>

                                            {/* Progress bar */}
                                            <div className="w-full bg-background/50 rounded-full h-2">
                                                <div
                                                    className="bg-gradient-to-r from-pink-500 to-purple-500 h-2 rounded-full transition-all duration-300"
                                                    style={{ width: `${(generationProgress.step / generationProgress.totalSteps) * 100}%` }}
                                                />
                                            </div>

                                            {/* Step indicator */}
                                            <div className="flex justify-between items-center text-xs text-muted-foreground">
                                                <span>Step {generationProgress.step} of {generationProgress.totalSteps}</span>
                                                <span className="capitalize px-2 py-0.5 bg-pink-500/10 rounded text-pink-500">
                                                    {generationProgress.phase}
                                                </span>
                                            </div>

                                            {/* Blocks generated indicator */}
                                            {generationProgress.blocksGenerated && (
                                                <div className="flex items-center gap-1 text-xs text-green-500">
                                                    <Blocks className="w-3 h-3" />
                                                    <span>{generationProgress.blocksGenerated} blocks generated</span>
                                                </div>
                                            )}

                                            {/* Optimized indicator for rationalization */}
                                            {generationProgress.phase === 'complete' && slowMode && (
                                                <div className="flex items-center gap-1 text-xs text-amber-500">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    <span>Logic optimized</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin text-pink-500" />
                                            <p className="text-sm text-muted-foreground">
                                                {isGenerateMode ? "Initializing..." : "Thinking..."}
                                            </p>
                                        </div>
                                    )}
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
        </div>
    );
};
