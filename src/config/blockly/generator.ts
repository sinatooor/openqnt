import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import { mqlGenerator } from './mqlGenerator';

// Import feature generators
import '../../features/core/generators';
import '../../features/indicators/generators';
import '../../features/trading/generators';


// Export function to generate code from workspace
export function generateCode(workspace: Blockly.WorkspaceSvg, language: 'javascript' | 'mql' = 'javascript', leverage: number = 1): string {
  if (language === 'mql') {
    return mqlGenerator.workspaceToCode(workspace, leverage);
  }
  return javascriptGenerator.workspaceToCode(workspace);
}

export { mqlGenerator };
