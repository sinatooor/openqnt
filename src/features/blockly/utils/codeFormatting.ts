/**
 * Code formatting utilities for Blockly workspace
 */

/**
 * Beautifies JavaScript code by adding proper indentation
 * @param code - Raw JavaScript code string
 * @returns Formatted code with proper indentation
 */
export const beautifyCode = (code: string): string => {
  if (!code) return code;
  let result = "";
  let indent = 0;
  const lines = code.split("\n");
  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Decrease indent for closing braces
    if (trimmed.startsWith("}")) {
      indent = Math.max(0, indent - 1);
    }

    // Add indentation
    result += "  ".repeat(indent) + trimmed + "\n";

    // Increase indent for opening braces
    if (trimmed.endsWith("{")) {
      indent++;
    }
  }
  return result;
};

/**
 * Calculate code statistics
 * @param code - JavaScript code to analyze
 * @param blockCount - Number of blocks in workspace
 * @returns Statistics including lines, chars, and complexity score
 */
export const getCodeStatistics = (code: string, blockCount: number) => {
  if (!code)
    return {
      lines: 0,
      chars: 0,
      complexity: 0,
    };

  const lines = code.split("\n").filter((line) => line.trim()).length;
  const chars = code.length;

  // Simple complexity estimation based on control structures
  const ifCount = (code.match(/if\s*\(/g) || []).length;
  const loopCount = (code.match(/while\s*\(|for\s*\(/g) || []).length;
  const complexity = ifCount + loopCount * 2 + Math.floor(blockCount / 5);

  return {
    lines,
    chars,
    complexity,
  };
};
