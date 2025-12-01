import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import { mqlGenerator } from './mqlGenerator';

// Import feature generators
import '../../features/core/generators';
import '../../features/indicators/generators';
import '../../features/trading/generators';


// Export function to generate code from workspace
export function generateCode(workspace: Blockly.WorkspaceSvg, language: 'javascript' | 'mql' = 'javascript'): string {
  if (language === 'mql') {
    return mqlGenerator.workspaceToCode(workspace);
  }
  return javascriptGenerator.workspaceToCode(workspace);
}

export { mqlGenerator };
