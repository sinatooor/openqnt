/**
 * Custom Block Loader
 * 
 * Fetches custom block definitions from the backend and dynamically
 * registers them with Blockly at runtime.
 */

import * as Blockly from 'blockly';

export interface CustomBlockInput {
    name: string;
    type: 'number' | 'boolean' | 'any';
    default?: any;
}

export interface CustomBlockDef {
    id: string;
    name: string;
    display_name: string;
    description: string;
    block_type: 'value' | 'condition' | 'action';
    inputs: CustomBlockInput[];
    output_type: string | null;
    python_code: string;
    color: string;
    category: string;
    blockly_definition?: any;
    created_at: string;
}

/**
 * Fetch all custom blocks from the backend with timeout
 */
export async function loadCustomBlocks(): Promise<CustomBlockDef[]> {
    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

    try {
        const response = await fetch('http://localhost:8000/custom-blocks', {
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn('Failed to load custom blocks:', response.status);
            return [];
        }

        const data = await response.json();
        return data.blocks || [];
    } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            console.warn('Custom blocks fetch timed out, proceeding without custom blocks');
        } else {
            console.warn('Error loading custom blocks:', error);
        }
        return [];
    }
}

/**
 * Register a custom block with Blockly
 */
export function registerCustomBlock(blockDef: CustomBlockDef): void {
    const blockType = blockDef.id;

    // Skip if already registered
    if (Blockly.Blocks[blockType]) {
        console.log(`Block ${blockType} already registered, skipping`);
        return;
    }

    // Create the block definition
    Blockly.Blocks[blockType] = {
        init: function () {
            // Build message with inputs
            let messageArr = [blockDef.display_name];
            const args: any[] = [];

            blockDef.inputs.forEach((input, idx) => {
                messageArr.push(`%${idx + 1}`);

                if (input.type === 'number') {
                    args.push({
                        type: 'input_value',
                        name: input.name,
                        check: 'Number'
                    });
                } else if (input.type === 'boolean') {
                    args.push({
                        type: 'input_value',
                        name: input.name,
                        check: 'Boolean'
                    });
                } else {
                    args.push({
                        type: 'input_value',
                        name: input.name
                    });
                }
            });

            // Set the message and args
            if (args.length > 0) {
                this.jsonInit({
                    type: blockType,
                    message0: messageArr.join(' '),
                    args0: args,
                    colour: blockDef.color || '#ef4444',
                    tooltip: blockDef.description,
                    helpUrl: ''
                });
            } else {
                this.appendDummyInput()
                    .appendField(blockDef.display_name);
                this.setColour(blockDef.color || '#ef4444');
                this.setTooltip(blockDef.description);
            }

            // Set output/connection based on block type
            if (blockDef.block_type === 'value') {
                this.setOutput(true, blockDef.output_type || 'Number');
            } else if (blockDef.block_type === 'condition') {
                this.setOutput(true, 'Boolean');
            } else if (blockDef.block_type === 'action') {
                this.setPreviousStatement(true, null);
                this.setNextStatement(true, null);
            }

            // Store metadata for code generation
            (this as any).customBlockData = {
                python_code: blockDef.python_code,
                block_type: blockDef.block_type
            };
        }
    };

    console.log(`Registered custom block: ${blockType}`);
}

/**
 * Register all custom blocks from the backend
 * Call this on app initialization
 */
export async function registerAllCustomBlocks(): Promise<CustomBlockDef[]> {
    const blocks = await loadCustomBlocks();

    blocks.forEach(block => {
        registerCustomBlock(block);
    });

    console.log(`Registered ${blocks.length} custom blocks`);
    return blocks;
}

/**
 * Generate toolbox items for custom blocks
 */
export function getCustomBlocksToolboxItems(blocks: CustomBlockDef[]): any[] {
    if (!blocks || blocks.length === 0) {
        return [{ kind: 'label', text: 'No custom blocks yet' }];
    }

    const items: any[] = [
        { kind: 'label', text: 'Custom Blocks' }
    ];

    blocks.forEach(block => {
        items.push({
            kind: 'block',
            type: block.id
        });
    });

    return items;
}
