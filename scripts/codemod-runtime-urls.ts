#!/usr/bin/env bun
/**
 * Codemod: replace direct reads of `import.meta.env.VITE_BACKEND_URL` (and
 * VITE_ORCHESTRATOR_URL, VITE_WS_URL) with `apiBase()` / `orchestratorBase()` /
 * `wsBase()` from `@/lib/runtimeConfig`.
 *
 * Runs on src/**\/*.{ts,tsx}, skipping the shim itself. Prints a summary of
 * replacements per file.
 *
 * Usage: bun run scripts/codemod-runtime-urls.ts
 *        bun run scripts/codemod-runtime-urls.ts --dry  (preview without writing)
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.resolve(__dirname, '..', 'src');
const SHIM_PATH = path.resolve(SRC_DIR, 'lib', 'runtimeConfig.ts');
const dry = process.argv.includes('--dry');

type Helper = 'apiBase' | 'orchestratorBase' | 'wsBase';

// Patterns are tried in order. Each entry maps a left-hand source pattern to
// the helper that replaces it. The pattern matches the *whole expression* so
// stray bits don't dangle.
const REPLACEMENTS: Array<{ name: Helper; patterns: RegExp[] }> = [
  {
    name: 'apiBase',
    patterns: [
      // (import.meta as any).env?.VITE_BACKEND_URL?.replace(/\/$/, '') ?? 'http://localhost:8000'
      /\(import\.meta\s+as\s+any\)\.env\?\.VITE_BACKEND_URL\?\.replace\(\/\\?\/\$\/,\s*['"]['"]\)\s*\?\?\s*['"]http:\/\/localhost:8000['"]/g,
      // (import.meta as any).env?.VITE_BACKEND_URL?.replace(/\/$/, '')
      /\(import\.meta\s+as\s+any\)\.env\?\.VITE_BACKEND_URL\?\.replace\(\/\\?\/\$\/,\s*['"]['"]\)/g,
      // (import.meta.env?.VITE_BACKEND_URL as string | undefined) || 'http://localhost:8000'
      /\(import\.meta\.env\?\.VITE_BACKEND_URL\s+as\s+string\s*\|\s*undefined\)\s*\|\|\s*['"]http:\/\/localhost:8000['"]/g,
      // import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'
      /import\.meta\.env\.VITE_BACKEND_URL\s*\|\|\s*['"]http:\/\/localhost:8000['"]/g,
      // import.meta.env?.VITE_BACKEND_URL ?? 'http://localhost:8000'
      /import\.meta\.env\??\.VITE_BACKEND_URL\s*\?\?\s*['"]http:\/\/localhost:8000['"]/g,
      // Bare reference (last) — careful, only matches the property access alone.
      /import\.meta\.env\.VITE_BACKEND_URL\b/g,
    ],
  },
  {
    name: 'orchestratorBase',
    patterns: [
      /\(import\.meta\s+as\s+any\)\.env\?\.VITE_ORCHESTRATOR_URL\?\.replace\(\/\\?\/\$\/,\s*['"]['"]\)\s*\?\?\s*['"]http:\/\/localhost:3000['"]/g,
      /\(import\.meta\.env\?\.VITE_ORCHESTRATOR_URL\s+as\s+string\s*\|\s*undefined\)\s*\|\|\s*['"]http:\/\/localhost:3000['"]/g,
      /import\.meta\.env\.VITE_ORCHESTRATOR_URL\s*\|\|\s*['"]http:\/\/localhost:3000['"]/g,
      /import\.meta\.env\??\.VITE_ORCHESTRATOR_URL\s*\?\?\s*['"]http:\/\/localhost:3000['"]/g,
      /import\.meta\.env\.VITE_ORCHESTRATOR_URL\b/g,
    ],
  },
  {
    name: 'wsBase',
    patterns: [
      /\(import\.meta\s+as\s+any\)\.env\?\.VITE_WS_URL\?\.replace\(\/\\?\/\$\/,\s*['"]['"]\)\s*\?\?\s*['"]ws:\/\/localhost:3000['"]/g,
      /import\.meta\.env\.VITE_WS_URL\s*\|\|\s*['"]ws:\/\/localhost:3000['"]/g,
      /import\.meta\.env\??\.VITE_WS_URL\s*\?\?\s*['"]ws:\/\/localhost:3000['"]/g,
      /import\.meta\.env\.VITE_WS_URL\b/g,
    ],
  },
];

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      await walk(full, out);
    } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function ensureImport(content: string, helpers: Set<Helper>): string {
  if (helpers.size === 0) return content;
  const importLine = `import { ${[...helpers].sort().join(', ')} } from '@/lib/runtimeConfig';`;
  // If an import from this module already exists, merge into it.
  const existing = content.match(
    /^import\s*\{\s*([^}]+)\s*\}\s*from\s*['"]@\/lib\/runtimeConfig['"];?\s*$/m,
  );
  if (existing) {
    const have = new Set(existing[1].split(',').map((s) => s.trim()).filter(Boolean));
    helpers.forEach((h) => have.add(h));
    const merged = [...have].sort().join(', ');
    return content.replace(existing[0], `import { ${merged} } from '@/lib/runtimeConfig';`);
  }
  // Otherwise insert after the last existing top-level import.
  const importBlockEnd = [...content.matchAll(/^import\s.+;\s*$/gm)].at(-1);
  if (importBlockEnd && importBlockEnd.index !== undefined) {
    const insertAt = importBlockEnd.index + importBlockEnd[0].length;
    return content.slice(0, insertAt) + '\n' + importLine + content.slice(insertAt);
  }
  return importLine + '\n' + content;
}

async function processFile(file: string): Promise<{ changed: boolean; counts: Record<Helper, number> }> {
  const original = await fs.readFile(file, 'utf8');
  let content = original;
  const counts: Record<Helper, number> = { apiBase: 0, orchestratorBase: 0, wsBase: 0 };

  for (const { name, patterns } of REPLACEMENTS) {
    for (const pat of patterns) {
      const before = content;
      content = content.replace(pat, () => {
        counts[name]++;
        return `${name}()`;
      });
      if (content !== before) pat.lastIndex = 0;
    }
  }

  const used = new Set<Helper>(
    (Object.keys(counts) as Helper[]).filter((k) => counts[k] > 0),
  );

  if (content === original) return { changed: false, counts };

  content = ensureImport(content, used);

  if (!dry) await fs.writeFile(file, content, 'utf8');
  return { changed: true, counts };
}

async function main() {
  const files = (await walk(SRC_DIR)).filter((f) => f !== SHIM_PATH);
  let totalFiles = 0;
  const totals: Record<Helper, number> = { apiBase: 0, orchestratorBase: 0, wsBase: 0 };

  for (const file of files) {
    const { changed, counts } = await processFile(file);
    if (changed) {
      totalFiles++;
      const summary = (Object.entries(counts) as Array<[Helper, number]>)
        .filter(([, c]) => c > 0)
        .map(([h, c]) => `${h}×${c}`)
        .join(' ');
      console.log(`  ${path.relative(process.cwd(), file)}  →  ${summary}`);
      (Object.keys(counts) as Helper[]).forEach((k) => (totals[k] += counts[k]));
    }
  }

  console.log('');
  console.log(`${dry ? '[dry-run] ' : ''}Modified ${totalFiles} files. Replacements:`);
  console.log(`  apiBase:          ${totals.apiBase}`);
  console.log(`  orchestratorBase: ${totals.orchestratorBase}`);
  console.log(`  wsBase:           ${totals.wsBase}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
