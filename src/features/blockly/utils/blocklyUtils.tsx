import React from "react";

export const beautifyCode = (code: string): string => {
    if (!code) return code;
    let result = "";
    let indent = 0;
    const lines = code.split("\n");
    for (let line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Check if line starts with closing brace to decrease indent BEFORE adding line
        if (trimmed.startsWith("}") || trimmed.startsWith("];") || trimmed.startsWith(");")) {
            indent = Math.max(0, indent - 1);
        }

        // Add indentation
        result += "    ".repeat(indent) + trimmed + "\n"; // Use 4 spaces for better readability

        // Check if line ends with opening brace to increase indent AFTER adding line
        // Also handle case statements
        if (trimmed.endsWith("{") || trimmed.endsWith("(") || trimmed.endsWith("[") || trimmed.endsWith(":") && !trimmed.includes("default:")) {
            indent++;
        }

        // Special handling for 'default:' to align with cases but indent content
        if (trimmed === "default:") {
            // Usually case/default are at same level as switch, content indented
            // But simple logic: if it ends in :, indent next line
            indent++;
        }
    }
    return result;
};

export const highlightSyntax = (line: string): JSX.Element => {
    if (!line.trim()) return <>{" "}</>;

    // Simple syntax highlighting for MQL5
    const keywords = [
        "if", "else", "while", "for", "do", "break", "continue", "return", "switch", "case", "default",
        "void", "int", "double", "bool", "string", "datetime", "ulong", "uint", "char", "short", "long", "float",
        "class", "struct", "enum", "input", "const", "static", "virtual", "override", "public", "private", "protected",
        "true", "false", "new", "delete", "operator", "this", "input", "sinput"
    ];
    const parts: JSX.Element[] = [];
    let remaining = line;
    let key = 0;

    // Handle comments
    if (line.trim().startsWith("//")) {
        return <span className="syntax-comment">{line}</span>;
    }

    // Simple tokenization
    const tokens = remaining.split(/(\s+|[{}();,\[\]])/);
    tokens.forEach(token => {
        if (keywords.includes(token)) {
            parts.push(<span key={key++} className="syntax-keyword">
                {token}
            </span>);
        } else if (token.match(/^['"].*['"]$/)) {
            parts.push(<span key={key++} className="syntax-string">
                {token}
            </span>);
        } else if (token.match(/^\d+(\.\d+)?$/)) {
            parts.push(<span key={key++} className="syntax-number">
                {token}
            </span>);
        } else if (token.match(/^[{}();,\[\]]$/)) {
            parts.push(<span key={key++} className="syntax-punctuation">
                {token}
            </span>);
        } else if (token.match(/^[A-Z][a-zA-Z0-9_]*$/) && !keywords.includes(token)) {
            // Capitalized words are likely types or classes
            parts.push(<span key={key++} className="syntax-type">
                {token}
            </span>);
        } else if (token.match(/^[a-zA-Z_][a-zA-Z0-9_]*(?=\()/) || (remaining.includes(token + '(') && !keywords.includes(token))) {
            // Words followed by ( are likely functions - this is a rough heuristic
            parts.push(<span key={key++} className="syntax-function">
                {token}
            </span>);
        } else if (token.match(/^[+\-*/%=&|<>!^]+$/)) {
            parts.push(<span key={key++} className="syntax-operator">
                {token}
            </span>);
        } else if (token.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
            // Variables/Identifiers - default color
            parts.push(<span key={key++} className="syntax-variable">
                {token}
            </span>);
        } else {
            parts.push(<span key={key++}>{token}</span>);
        }
    });
    return <>{parts}</>;
};
