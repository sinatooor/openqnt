import { useState, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Wand2, Copy, Check, Upload, X, Code2 } from "lucide-react";
import { toast } from "sonner";

export interface CodeViewPanelProps {
    // Code content
    mqlCode: string;
    xmlCode: string;
    onXmlCodeChange: (code: string) => void;

    // Settings
    showLineNumbers: boolean;
    onToggleLineNumbers: () => void;
    beautified: boolean;
    onToggleBeautified: () => void;

    // Actions
    onCopy: () => void;
    onCreateBlocks: (xml: string) => void;
    onClose?: () => void;

    // Helpers
    renderCodeWithLineNumbers: (code: string) => ReactNode;
    getCodeStatistics: () => { lines: number; chars: number; complexity: number };
}

export const CodeViewPanel = ({
    mqlCode,
    xmlCode,
    onXmlCodeChange,
    showLineNumbers,
    onToggleLineNumbers,
    beautified,
    onToggleBeautified,
    onCopy,
    onCreateBlocks,
    onClose,
    renderCodeWithLineNumbers,
    getCodeStatistics,
}: CodeViewPanelProps) => {
    const [codeTab, setCodeTab] = useState<"mql" | "xml">("mql");
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        onCopy();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCreateBlocks = () => {
        if (!xmlCode) {
            toast.error("No XML code to load");
            return;
        }
        onCreateBlocks(xmlCode);
    };

    const stats = getCodeStatistics();

    return (
        <div className="w-96 bg-card border-l border-border flex flex-col overflow-hidden animate-fade-in h-full">
            {/* Header */}
            <div className="px-3 py-2 border-b border-border">
                <div className="flex items-center justify-between mb-3 gap-2">
                    <div className="flex items-center gap-2">
                        <Code2 className="w-4 h-4 text-blue-500" />
                        <h2 className="font-semibold text-foreground text-sm">Generated Code</h2>
                    </div>
                    <div className="flex items-center gap-1">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleCopy}>
                                    {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copy to clipboard</TooltipContent>
                        </Tooltip>
                        {onClose && (
                            <Button onClick={onClose} variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10">
                                <X className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* Tab Selector */}
                <div className="flex gap-2">
                    <Button
                        variant={codeTab === "mql" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setCodeTab("mql")}
                        className="flex-1"
                    >
                        MQL5
                    </Button>
                    <Button
                        variant={codeTab === "xml" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setCodeTab("xml")}
                        className="flex-1"
                    >
                        XML
                    </Button>
                </div>

                {/* Code options for MQL tab */}
                {codeTab === "mql" && (
                    <div className="flex items-center gap-2 mt-2">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={beautified ? "secondary" : "outline"}
                                    size="sm"
                                    className="h-7"
                                    onClick={onToggleBeautified}
                                >
                                    <Wand2 className="w-3 h-3 mr-1" />
                                    Format
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Format Code</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={showLineNumbers ? "secondary" : "outline"}
                                    size="sm"
                                    className="h-7"
                                    onClick={onToggleLineNumbers}
                                >
                                    <span className="text-xs font-mono">#</span>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Toggle line numbers</TooltipContent>
                        </Tooltip>
                    </div>
                )}
            </div>

            {/* Code content */}
            <div className="flex-1 overflow-auto p-4">
                {codeTab === "mql" ? (
                    <div className="font-mono text-xs">
                        {renderCodeWithLineNumbers(mqlCode)}
                    </div>
                ) : (
                    <textarea
                        value={xmlCode || ""}
                        onChange={(e) => onXmlCodeChange(e.target.value)}
                        className="w-full h-full font-mono text-xs bg-secondary text-foreground resize-none focus:outline-none p-2 border border-border rounded-md focus:border-primary/50 transition-colors"
                        spellCheck={false}
                        placeholder="<!-- Paste Blockly XML here and click 'Create Blocks' -->"
                    />
                )}
            </div>

            {/* Footer */}
            <div className="px-3 py-2 border-t border-border bg-muted/30 flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex gap-3">
                    {codeTab === "mql" ? (
                        <>
                            <span>{stats.lines} lines</span>
                            <span>{stats.chars} chars</span>
                        </>
                    ) : (
                        <>
                            <span>{(xmlCode.match(/\n/g) || []).length + 1} lines</span>
                            <span>{xmlCode.length} chars</span>
                        </>
                    )}
                </div>
                <div className="flex gap-2 items-center">
                    {codeTab === "xml" && (
                        <Button
                            variant="default"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={handleCreateBlocks}
                        >
                            <Upload className="w-3 h-3 mr-1" />
                            Create Blocks
                        </Button>
                    )}
                    <span className="text-muted-foreground">
                        {codeTab === "mql" ? `Complexity: ${stats.complexity}` : "Live Edit"}
                    </span>
                </div>
            </div>
        </div>
    );
};
