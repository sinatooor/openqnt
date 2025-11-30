import { useEffect, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import { environmentBlocksToolbox, operatorBlocksToolbox, controlBlocksToolbox, tradeBlocksToolbox, taBlocksToolbox, myBlocksToolbox } from "@/blockly/blocks";
import { generateCode } from "@/blockly/generators/javascript";

interface UseBlocklyProps {
    initialXml?: string;
    onCodeChange?: (code: string) => void;
    onXmlChange?: (xml: string) => void;
}

export const useBlockly = ({ initialXml, onCodeChange, onXmlChange }: UseBlocklyProps = {}) => {
    const blocklyDiv = useRef<HTMLDivElement>(null);
    const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
    const [generatedCode, setGeneratedCode] = useState<string>("");
    const [xml, setXml] = useState<string>("");

    useEffect(() => {
        if (!blocklyDiv.current || workspaceRef.current) return;

        // Create custom dark theme matching the app design
        const darkTheme = Blockly.Theme.defineTheme("dark", {
            name: "dark",
            base: Blockly.Themes.Classic,
            componentStyles: {
                workspaceBackgroundColour: "#181c23",
                toolboxBackgroundColour: "#1c2028",
                toolboxForegroundColour: "#f8fafc",
                flyoutBackgroundColour: "#1c2028",
                flyoutForegroundColour: "#94a3b8",
                flyoutOpacity: 0.95,
                scrollbarColour: "#25292f",
                scrollbarOpacity: 0.5,
                insertionMarkerColour: "#3b82f6",
                insertionMarkerOpacity: 0.3
            },
            blockStyles: {
                environment_blocks: { colourPrimary: "#10b981", colourSecondary: "#059669", colourTertiary: "#047857" },
                operator_blocks: { colourPrimary: "#3b82f6", colourSecondary: "#2563eb", colourTertiary: "#1d4ed8" },
                control_blocks: { colourPrimary: "#f59e0b", colourSecondary: "#d97706", colourTertiary: "#b45309" },
                trade_blocks: { colourPrimary: "#06b6d4", colourSecondary: "#0891b2", colourTertiary: "#0e7490" },
                ta_blocks: { colourPrimary: "#8b5cf6", colourSecondary: "#7c3aed", colourTertiary: "#6d28d9" },
                risk_blocks: { colourPrimary: "#ec4899", colourSecondary: "#db2777", colourTertiary: "#be185d" },
                mtf_blocks: { colourPrimary: "#06b6d4", colourSecondary: "#0891b2", colourTertiary: "#0e7490" },
                variable_blocks: { colourPrimary: "#64748b", colourSecondary: "#475569", colourTertiary: "#334155" },
                function_blocks: { colourPrimary: "#ef4444", colourSecondary: "#dc2626", colourTertiary: "#b91c1c" }
            }
        });

        // Initialize workspace
        const workspace = Blockly.inject(blocklyDiv.current, {
            renderer: 'zelos',
            theme: darkTheme,
            toolbox: {
                kind: "categoryToolbox",
                contents: [
                    { kind: "category", name: "AI", colour: "#ec4899", custom: "AI_CATEGORY" },
                    { kind: "sep" },
                    { kind: "category", name: "Environment", colour: "#10b981", contents: environmentBlocksToolbox },
                    { kind: "category", name: "Control", colour: "#f59e0b", contents: controlBlocksToolbox },
                    { kind: "category", name: "Operators", colour: "#3b82f6", contents: operatorBlocksToolbox },
                    { kind: "category", name: "TA Tools", colour: "#8b5cf6", contents: taBlocksToolbox },
                    { kind: "category", name: "Values", colour: "#64748b", contents: [{ kind: "block", type: "math_number", fields: { NUM: 0 } }] },
                    { kind: "category", name: "Trade", colour: "#06b6d4", contents: tradeBlocksToolbox },
                    { kind: "category", name: "My Blocks", colour: "#ef4444", contents: myBlocksToolbox }
                ]
            },
            grid: { spacing: 20, length: 3, colour: "#2a2e35", snap: true },
            zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 3, minScale: 0.3, scaleSpeed: 1.2 },
            trashcan: true,
            move: { scrollbars: { horizontal: true, vertical: true }, drag: true, wheel: true }
        });

        workspaceRef.current = workspace;

        // Initial XML load
        if (initialXml) {
            const xmlDom = Blockly.utils.xml.textToDom(initialXml);
            Blockly.Xml.domToWorkspace(xmlDom, workspace);
        }

        // Listeners
        workspace.addChangeListener(() => {
            const code = generateCode(workspace);
            setGeneratedCode(code);
            if (onCodeChange) onCodeChange(code);

            const xmlDom = Blockly.Xml.workspaceToDom(workspace);
            const xmlText = Blockly.Xml.domToText(xmlDom);
            setXml(xmlText);
            if (onXmlChange) onXmlChange(xmlText);
        });

        // Resize observer
        const resizeObserver = new ResizeObserver(() => {
            Blockly.svgResize(workspace);
        });
        if (blocklyDiv.current) {
            resizeObserver.observe(blocklyDiv.current);
        }

        return () => {
            resizeObserver.disconnect();
            workspace.dispose();
            workspaceRef.current = null;
        };
    }, []);

    return { blocklyDiv, workspaceRef, generatedCode, xml };
};
