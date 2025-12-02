/**
 * Syntax highlighting utilities for JavaScript code
 */

/**
 * Apply simple syntax highlighting to a line of JavaScript code
 * @param line - A single line of JavaScript code
 * @returns JSX element with syntax-highlighted code
 */
export const highlightSyntax = (line: string): JSX.Element => {
  if (!line.trim()) return <span> </span>;

  // Simple syntax highlighting for JavaScript
  const keywords = [
    "if",
    "else",
    "while",
    "for",
    "function",
    "return",
    "var",
    "let",
    "const",
  ];
  const parts: JSX.Element[] = [];
  let key = 0;

  // Handle comments
  if (line.trim().startsWith("//")) {
    return <span className="text-green-500/70">{line}</span>;
  }

  // Simple tokenization
  const tokens = line.split(/(\s+|[{}();,])/);
  tokens.forEach((token) => {
    if (keywords.includes(token)) {
      parts.push(
        <span key={key++} className="text-purple-400 font-semibold">
          {token}
        </span>
      );
    } else if (token.match(/^['"].*['"]$/)) {
      parts.push(
        <span key={key++} className="text-green-400">
          {token}
        </span>
      );
    } else if (token.match(/^\d+$/)) {
      parts.push(
        <span key={key++} className="text-orange-400">
          {token}
        </span>
      );
    } else if (token.match(/^[{}();,]$/)) {
      parts.push(
        <span key={key++} className="text-muted-foreground">
          {token}
        </span>
      );
    } else {
      parts.push(<span key={key++}>{token}</span>);
    }
  });
  return <>{parts}</>;
};
