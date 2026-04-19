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

const registry = new Map<string, AnyTerminalTool>();

export function registerTerminalTool<TInput, TData>(tool: TerminalTool<TInput, TData>): void {
  registry.set(tool.code.toUpperCase(), tool as unknown as AnyTerminalTool);
}

export function getTerminalTool(code: string): AnyTerminalTool | undefined {
  return registry.get(code.toUpperCase());
}

export function listTerminalTools(): AnyTerminalTool[] {
  return Array.from(registry.values());
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
