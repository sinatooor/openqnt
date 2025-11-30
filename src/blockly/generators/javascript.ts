import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';

// Import feature generators
import '../../features/core/generators';
import '../../features/indicators/generators';
import '../../features/trading/generators';
import './variableGenerators';

// Export function to generate code from workspace
export function generateCode(workspace: Blockly.WorkspaceSvg): string {
  return javascriptGenerator.workspaceToCode(workspace);
}
