import { useEffect, useRef, useState } from "react";
import * as Blockly from "blockly";
import { operatorBlocksToolbox, environmentBlocksToolbox } from "@/blockly/blocks";
import { indicatorComponentToolbox } from "@/blockly/blocks/indicatorComponentBlocks";
import "@/styles/blockly-custom.css";

interface SubLogicWorkspaceProps {
    initialXml?: string;
    onXmlChange?: (xml: string) => void;
    indicatorType?: string;
}

export const SubLogicWorkspace = ({
    initialXml,
    onXmlChange,
    indicatorType
}: SubLogicWorkspaceProps) => {
    const blocklyDiv = useRef<HTMLDivElement>(null);
    const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);

    useEffect(() => {
        if (!blocklyDiv.current) return;

        // Define a simplified theme for the sub-workspace
        const darkTheme = Blockly.Theme.defineTheme("dark_sub", {
            name: "dark_sub",
            base: Blockly.Themes.Classic,
            componentStyles: {
                workspaceBackgroundColour: "#1e293b", // Slightly lighter than main
                toolboxBackgroundColour: "#0f172a",
                toolboxForegroundColour: "#f8fafc",
                flyoutBackgroundColour: "#0f172a",
                flyoutForegroundColour: "#94a3b8",
                flyoutOpacity: 0.95,
                scrollbarColour: "#334155",
                scrollbarOpacity: 0.5,
                insertionMarkerColour: "#3b82f6",
                insertionMarkerOpacity: 0.3
            },
            blockStyles: {
                operator_blocks: {
                    colourPrimary: "#3b82f6",
                    colourSecondary: "#2563eb",
                    colourTertiary: "#1d4ed8"
                },
                component_blocks: {
                    colourPrimary: "#8b5cf6",
                    colourSecondary: "#7c3aed",
                    colourTertiary: "#6d28d9"
                }
            }
        });

        // Initialize workspace
        const workspace = Blockly.inject(blocklyDiv.current, {
            renderer: 'zelos',
            theme: darkTheme,
            toolbox: {
                kind: "categoryToolbox",
                contents: [
                    {
                        kind: "category",
                        name: "Logic & Math",
                        colour: "#3b82f6",
                        contents: operatorBlocksToolbox
                    },
                    {
                        kind: "category",
                        name: "Environment",
                        colour: "#10b981",
                        contents: environmentBlocksToolbox
                    },
                    {
                        kind: "category",
                        name: "Indicator Components",
                        colour: "#8b5cf6",
                        contents: indicatorType && (indicatorComponentToolbox as any)[indicatorType]
                            ? (indicatorComponentToolbox as any)[indicatorType]
                            : []
                    }
                ]
            },
            zoom: {
                controls: true,
                wheel: true,
                startScale: 0.8,
                maxScale: 2,
                minScale: 0.4,
                scaleSpeed: 1.2
            },
            trashcan: true,
            move: {
                scrollbars: true,
                drag: true,
                wheel: true
            }
        });
        workspaceRef.current = workspace;

        // Load initial XML if provided
        if (initialXml) {
            try {
                const xml = Blockly.utils.xml.textToDom(initialXml);
                Blockly.Xml.domToWorkspace(xml, workspace);
            } catch (e) {
                console.error("Failed to load initial XML", e);
            }
        }

        // Listen for changes
        workspace.addChangeListener(() => {
            if (onXmlChange) {
                const xml = Blockly.Xml.workspaceToDom(workspace);
                const xmlText = Blockly.Xml.domToText(xml);
                onXmlChange(xmlText);
            }
        });

        return () => {
            workspace.dispose();
        };
    }, []); // Run once on mount

    // Handle resizing
    useEffect(() => {
        const handleResize = () => {
            if (workspaceRef.current) {
                Blockly.svgResize(workspaceRef.current);
            }
        };
        window.addEventListener("resize", handleResize);
        // Trigger initial resize after a short delay to ensure container is ready
        setTimeout(handleResize, 100);

        return () => window.removeEventListener("resize", handleResize);
    }, []);

    return (
        <div className="w-full h-full relative rounded-md overflow-hidden border border-border">
            <div ref={blocklyDiv} className="absolute inset-0" />
        </div>
    );
};
