import { useState, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Wand2, Copy, Check, Upload } from "lucide-react";
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
        <div className="w-[500px] h-full border-l border-[#3e3e42] bg-[#1e1e1e] flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header with tabs */}
            <div className="h-12 border-b border-[#3e3e42] flex items-center justify-between px-4 bg-[#252526]">
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setCodeTab("mql")}
                        className={cn(
                            "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                            codeTab === "mql"
                                ? "bg-primary/20 text-primary"
                                : "text-gray-400 hover:text-gray-200 hover:bg-[#3e3e42]"
                        )}
                    >
                        MQL5
                    </button>
                    <button
                        onClick={() => setCodeTab("xml")}
                        className={cn(
                            "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                            codeTab === "xml"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "text-gray-400 hover:text-gray-200 hover:bg-[#3e3e42]"
                        )}
                    >
                        XML
                    </button>
                </div>
                <div className="flex items-center gap-1">
                    {codeTab === "mql" && (
                        <>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleBeautified}>
                                        <Wand2 className={`w-3 h-3 ${beautified ? "text-primary" : ""}`} />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Format Code</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleLineNumbers}>
                                        <span className="text-xs font-mono">#</span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Toggle line numbers</TooltipContent>
                            </Tooltip>
                        </>
                    )}
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleCopy}>
                                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Copy to clipboard</TooltipContent>
                    </Tooltip>
                </div>
            </div>

            {/* Code content */}
            <div className="flex-1 flex flex-col min-h-0 relative bg-[#1e1e1e] text-gray-300">
                <div className="flex-1 flex flex-col min-h-0 p-4">
                    {codeTab === "mql" ? (
                        <div className="flex-1 overflow-auto custom-scrollbar">
                            {renderCodeWithLineNumbers(mqlCode)}
                        </div>
                    ) : (
                        <textarea
                            value={xmlCode || ""}
                            onChange={(e) => onXmlCodeChange(e.target.value)}
                            className="w-full h-full flex-1 font-mono text-sm bg-transparent text-emerald-300 resize-none focus:outline-none p-2 border border-dashed border-[#3e3e42] rounded-md focus:border-emerald-500/50 transition-colors"
                            spellCheck={false}
                            placeholder="<!-- Paste Blockly XML here and click 'Create Blocks' -->"
                        />
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="h-10 border-t border-[#3e3e42] flex items-center justify-between px-4 bg-[#252526] text-xs text-gray-400">
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
                <div className="flex gap-2">
                    {codeTab === "xml" && (
                        <Button
                            variant="default"
                            size="sm"
                            className="h-6 px-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={handleCreateBlocks}
                        >
                            <Upload className="w-3 h-3 mr-1" />
                            Create Blocks
                        </Button>
                    )}
                    <div>
                        {codeTab === "mql" ? `Complexity: ${stats.complexity}` : "Live Edit"}
                    </div>
                </div>
            </div>
        </div>
    );
};
