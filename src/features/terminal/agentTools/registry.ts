/**
 * Central registry for all terminal functions that quant agents can invoke.
 *
 * Usage from the UI / command-bar:
 *   import { terminalTools, getTerminalTool } from '@/features/terminal/agentTools/registry';
 *
 * Usage from an agent (pseudo):
 *   const tool = getTerminalTool('HDS');
 *   const data = await tool.fetch({ ticker: 'AAPL' });
 *   const text = tool.formatForAgent(data);
 *   // inject `text` into the model's context
 *
 * Tools register themselves by importing this module and calling
 * `registerTerminalTool(...)` at module load.  Each feature folder owns its
 * own `tool.ts` which is re-exported from the feature barrel.
 */

import type { AnyTerminalTool, TerminalTool } from './types';

// The registry Map is stored as a property of the (hoisted) `getRegistry`
// function rather than as a module-level `let`/`const`, because the
// self-registering tool modules imported at the bottom of this file are
// evaluated *before* any top-level code here runs. A `let` or `const` would
// still be in its Temporal Dead Zone at that moment and throw
// `ReferenceError: Cannot access 'registry' before initialization`.
// Function declarations, on the other hand, are fully hoisted (name + value),
// so `getRegistry` — and any property we hang off it — is always safe to use.
function getRegistry(): Map<string, AnyTerminalTool> {
  const self = getRegistry as typeof getRegistry & {
    instance?: Map<string, AnyTerminalTool>;
  };
  if (!self.instance) self.instance = new Map<string, AnyTerminalTool>();
  return self.instance;
}

export function registerTerminalTool<TInput, TData>(tool: TerminalTool<TInput, TData>): void {
  getRegistry().set(tool.code.toUpperCase(), tool as unknown as AnyTerminalTool);
}

export function getTerminalTool(code: string): AnyTerminalTool | undefined {
  return getRegistry().get(code.toUpperCase());
}

export function listTerminalTools(): AnyTerminalTool[] {
  return Array.from(getRegistry().values());
}

/**
 * Callable façade an agent can point at.  Returns the formatted text
 * payload ready to go into a prompt window.
 */
export async function callTerminalTool(
  code: string,
  input: Record<string, unknown>,
): Promise<{ code: string; text: string; data: unknown }> {
  const tool = getTerminalTool(code);
  if (!tool) throw new Error(`No terminal tool registered for code "${code}"`);
  const data = await tool.fetch(input);
  const text = tool.formatForAgent(data);
  return { code: tool.code, text, data };
}

/* --------------------------- Self-registration --------------------------- */
/*                                                                          */
/*  Import the feature-level `tool.ts` modules here so the first time this  */
/*  registry is touched all known functions become available.  Keep this    */
/*  list alphabetical for easy scanning.                                    */
/*                                                                          */
/* ------------------------------------------------------------------------ */

import '../bmap/weiTool';
import '../des/tool';
import '../gip/tool';
import '../hds/tool';
import '../splc/tool';
