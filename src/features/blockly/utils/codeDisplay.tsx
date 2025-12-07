/**
 * Code display utilities for rendering code with line numbers
 */

import { beautifyCode } from "./codeFormatting";
import { highlightSyntax } from "./syntaxHighlighting";

interface RenderCodeOptions {
  showLineNumbers: boolean;
  beautified: boolean;
}

/**
 * Render code with optional line numbers and syntax highlighting
 * @param code - JavaScript code to render
 * @param options - Display options (line numbers, beautification)
 * @returns JSX element with formatted code
 */
export const renderCodeWithLineNumbers = (
  code: string,
  options: RenderCodeOptions
): JSX.Element => {
  const { showLineNumbers, beautified } = options;

  if (!code) {
    return (
      <div className="text-muted-foreground italic">
        // No blocks yet
        <br />
        // Drag blocks from the toolbox to start building your strategy
      </div>
    );
  }

  const displayCode = beautified ? beautifyCode(code) : code;
  const lines = displayCode.split("\n");

  return (
    <div className="flex font-mono text-sm">
      {showLineNumbers && (
        <div className="select-none pr-4 text-muted-foreground/50 text-right border-r border-border">
          {lines.map((_, i) => (
            <div key={i} className="leading-6">
              {i + 1}
            </div>
          ))}
        </div>
      )}
      <div className="flex-1 pl-4">
        {lines.map((line, i) => (
          <div key={i} className="leading-6">
            <code className="syntax-highlight">{highlightSyntax(line)}</code>
          </div>
        ))}
      </div>
    </div>
  );
};
