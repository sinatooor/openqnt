import { useEffect, useRef, RefObject, MutableRefObject } from 'react';
import * as Blockly from 'blockly';
import { toast } from 'sonner';
import { environmentBlocksToolbox, operatorBlocksToolbox, controlBlocksToolbox, tradeBlocksToolbox, taBlocksToolbox, myBlocksToolbox } from "@/config/blockly/toolbox";
import { registerAllCustomBlocks, getCustomBlocksToolboxItems, CustomBlockDef } from '@/lib/customBlockLoader';

interface UseBlocklyInitProps {
    containerRef: RefObject<HTMLDivElement>;
    workspaceRef: MutableRefObject<Blockly.WorkspaceSvg | null>;
    onWorkspaceRef?: (workspace: Blockly.WorkspaceSvg | null) => void;
    onXmlChange?: (xml: string | null) => void;
    setBlockCount: (count: number) => void;
    setShowAIPanel: (value: boolean | ((prev: boolean) => boolean)) => void;
    setIsDraggingBlock: (isDragging: boolean) => void;
    setDraggedBlockData: (data: { xml: string; name: string } | null) => void;
    aiPanelRef: RefObject<HTMLDivElement>;
    handleOpenAdvancedLogic: (blockId: string, type: string, xml: string) => void;
    handleOpenIndicatorSettings: (blockId: string, indicatorName: string) => void;
}

export const useBlocklyInit = ({
    containerRef,
    workspaceRef,
    onWorkspaceRef,
    onXmlChange,
    setBlockCount,
    setShowAIPanel,
    setIsDraggingBlock,
    setDraggedBlockData,
    aiPanelRef,
    handleOpenAdvancedLogic,
    handleOpenIndicatorSettings
}: UseBlocklyInitProps) => {
    const customBlocksRef = useRef<CustomBlockDef[]>([]);
    const initDoneRef = useRef(false);

    useEffect(() => {
        if (!containerRef.current || initDoneRef.current) return;
        initDoneRef.current = true;

        // Async initialization to load custom blocks first
        const initWorkspace = async () => {
            // Load and register custom blocks from backend
            try {
                const customBlocks = await registerAllCustomBlocks();
                customBlocksRef.current = customBlocks;
                if (customBlocks.length > 0) {
                    console.log(`Loaded ${customBlocks.length} custom blocks`);
                }
            } catch (e) {
                console.warn('Failed to load custom blocks:', e);
            }

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
                    environment_blocks: {
                        colourPrimary: "#10b981",
                        colourSecondary: "#059669",
                        colourTertiary: "#047857"
                    },
                    operator_blocks: {
                        colourPrimary: "#3b82f6",
                        colourSecondary: "#2563eb",
                        colourTertiary: "#1d4ed8"
                    },
                    control_blocks: {
                        colourPrimary: "#f59e0b",
                        colourSecondary: "#d97706",
                        colourTertiary: "#b45309"
                    },
                    trade_blocks: {
                        colourPrimary: "#06b6d4",
                        colourSecondary: "#0891b2",
                        colourTertiary: "#0e7490"
                    },
                    ta_blocks: {
                        colourPrimary: "#8b5cf6",
                        colourSecondary: "#7c3aed",
                        colourTertiary: "#6d28d9"
                    },
                    risk_blocks: {
                        colourPrimary: "#ec4899",
                        colourSecondary: "#db2777",
                        colourTertiary: "#be185d"
                    },
                    mtf_blocks: {
                        colourPrimary: "#06b6d4",
                        colourSecondary: "#0891b2",
                        colourTertiary: "#0e7490"
                    },
                    variable_blocks: {
                        colourPrimary: "#64748b",
                        colourSecondary: "#475569",
                        colourTertiary: "#334155"
                    },
                    function_blocks: {
                        colourPrimary: "#ef4444",
                        colourSecondary: "#dc2626",
                        colourTertiary: "#b91c1c"
                    }
                }
            });

            // Initialize workspace with configuration
            const workspace = Blockly.inject(containerRef.current, {
                renderer: 'zelos',
                theme: darkTheme,
                toolbox: {
                    kind: "categoryToolbox",
                    contents: [{
                        kind: "category",
                        name: "AI",
                        colour: "#ec4899",
                        custom: "AI_CATEGORY"
                    }, {
                        kind: "sep"
                    }, {
                        kind: "category",
                        name: "Environment",
                        colour: "#10b981",
                        contents: environmentBlocksToolbox
                    }, {
                        kind: "category",
                        name: "Control",
                        colour: "#f59e0b",
                        contents: controlBlocksToolbox
                    }, {
                        kind: "category",
                        name: "Operators",
                        colour: "#3b82f6",
                        contents: operatorBlocksToolbox
                    }, {
                        kind: "category",
                        name: "TA Tools",
                        colour: "#8b5cf6",
                        contents: taBlocksToolbox
                    }, {
                        kind: "category",
                        name: "Values",
                        colour: "#64748b",
                        contents: [{
                            kind: "block",
                            type: "math_number",
                            fields: {
                                NUM: 0
                            }
                        }]
                    }, {
                        kind: "category",
                        name: "Trade",
                        colour: "#06b6d4",
                        contents: tradeBlocksToolbox
                    }, {
                        kind: "category",
                        name: "My Blocks",
                        colour: "#ef4444",
                        contents: [
                            ...myBlocksToolbox,
                            ...getCustomBlocksToolboxItems(customBlocksRef.current)
                        ]
                    }]
                },
                grid: {
                    spacing: 20,
                    length: 3,
                    colour: "#2a2e35",
                    snap: true
                },
                zoom: {
                    controls: true,
                    wheel: true,
                    startScale: 0.9,
                    maxScale: 3,
                    minScale: 0.3,
                    scaleSpeed: 1.2
                },
                trashcan: true,
                move: {
                    scrollbars: {
                        horizontal: true,
                        vertical: true
                    },
                    drag: true,
                    wheel: true
                }
            });
            workspaceRef.current = workspace;
            onWorkspaceRef?.(workspace);

            // Register custom category callback for AI
            workspace.registerToolboxCategoryCallback("AI_CATEGORY", () => {
                setShowAIPanel(prev => !prev);
                return [];
            });

            // Register button callback for MACD settings
            workspace.registerButtonCallback('CONFIG_MACD', () => {
                toast.info('MACD Settings', {
                    description: 'Settings modal coming soon! For now, using default periods: 12/26/9'
                });
            });

            // Add drag event listener for blocks to enable dragging to chat
            workspace.addChangeListener((event: any) => {
                if (event.type === Blockly.Events.BLOCK_DRAG) {
                    const block = workspace.getBlockById(event.blockId);
                    if (event.isStart && block) {
                        // Drag started
                        const blockXml = Blockly.Xml.blockToDom(block as Blockly.BlockSvg);
                        const xmlText = Blockly.Xml.domToText(blockXml);
                        const blockName = (block as any).type?.replace(/_/g, ' ') || 'Unknown block';

                        setIsDraggingBlock(true);
                        setDraggedBlockData({
                            xml: xmlText,
                            name: blockName
                        });
                    } else if (!event.isStart) {
                        // Drag ended - check if dropped on AI panel
                        const aiPanel = aiPanelRef.current;
                        // We can't access draggedBlockData state here reliably due to closure stale state if not in dep array?
                        // Actually, we need to pass a ref or rely on event handling logic not needing state?
                        // The data was set in state.
                        // The event handler handles adding to chat if dropped on panel.
                        // BUT, we need access to the data we Just set??
                        // 'draggedBlockData' is state in component.
                        // We might need a ref for draggedBlockData to access it inside this callback without re-binding listener.
                        // Or just let component handle the drop event if possible? 
                        // No, this is inside Blockly change listener.
                        // Simple fix: We check mouse position here.
                        // But we need the data.
                        // Ideally, we store the drag data in a transient ref in the component or hook.
                        // Since we moved it to a hook, we can use a local ref for data!
                        // But we also need to update the UI (state).
                        // So we set state AND keep a ref?
                        // Or just use the block info from event again since we have blockId?
                        // Lines 338-360 in original code use 'draggedBlockData' state.
                        // This dependency on state inside an event listener added once is dangerous (stale closure).
                        // Original code added listener in useEffect with [] dep array!
                        // So 'draggedBlockData' was ALWAYS null in the closure?
                        // Line 340: `if (aiPanel && draggedBlockData)`.
                        // If `draggedBlockData` is state from closure, it is STALE (null).
                        // So the drag-to-chat feature likely DID NOT WORK or was buggy in the original code!
                        // I should fix this.
                        // I will use `workspace.getBlockById(event.blockId)` again to get data.

                        if (aiPanel) {
                            // Re-fetch data
                            const block = workspace.getBlockById(event.blockId);
                            if (block) {
                                const blockXml = Blockly.Xml.blockToDom(block as Blockly.BlockSvg);
                                const xmlText = Blockly.Xml.domToText(blockXml);
                                const blockName = (block as any).type?.replace(/_/g, ' ') || 'Unknown block';

                                const rect = aiPanel.getBoundingClientRect();
                                const mouseX = (event as any).clientX || (window as any).lastMouseX;
                                const mouseY = (event as any).clientY || (window as any).lastMouseY;

                                if (mouseX >= rect.left && mouseX <= rect.right &&
                                    mouseY >= rect.top && mouseY <= rect.bottom) {

                                    const chatInput = document.querySelector('[data-ai-chat-input]') as HTMLInputElement;
                                    if (chatInput) {
                                        const addBlockEvent = new CustomEvent('addBlockToChat', {
                                            detail: { xml: xmlText, name: blockName }
                                        });
                                        window.dispatchEvent(addBlockEvent);
                                        toast.success(`Block attached: ${blockName}`);
                                    }
                                }
                            }
                        }

                        setIsDraggingBlock(false);
                        setDraggedBlockData(null);
                    }
                }
            });

            // Track mouse position for drop detection
            const trackMouse = (e: MouseEvent) => {
                (window as any).lastMouseX = e.clientX;
                (window as any).lastMouseY = e.clientY;
            };
            document.addEventListener('mousemove', trackMouse);

            // Listen to workspace changes to update code and stats
            workspace.addChangeListener(() => {
                // Update block count
                const allBlocks = workspace.getAllBlocks(false);
                setBlockCount(allBlocks.length);

                // Generate XML for parent component
                if (allBlocks.length > 0) {
                    const xml = Blockly.Xml.workspaceToDom(workspace);
                    const xmlText = Blockly.Xml.domToText(xml);
                    onXmlChange?.(xmlText);
                } else {
                    onXmlChange?.(null);
                }
            });

            // Register global handlers
            (window as any).openAdvancedLogicModal = handleOpenAdvancedLogic;
            (window as any).openIndicatorSettings = handleOpenIndicatorSettings;
        };

        // Run the async initialization
        initWorkspace();

        // Cleanup on unmount
        return () => {
            document.removeEventListener('mousemove', (e: MouseEvent) => {
                (window as any).lastMouseX = e.clientX;
                (window as any).lastMouseY = e.clientY;
            });
            delete (window as any).openAdvancedLogicModal;
            delete (window as any).openIndicatorSettings;
            if (workspaceRef.current) {
                workspaceRef.current.dispose();
            }
        };
    }, []); // Run once
};
