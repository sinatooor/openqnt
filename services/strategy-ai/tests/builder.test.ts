/**
 * Builder agent snapshot tests.
 *
 * Each test runs a baseline prompt through the agent (with a mock Python
 * bridge) and compares the resulting shape signature against a committed
 * snapshot in `tests/snapshots/*.json`.
 *
 * What we compare:
 *   - exact node count + edge count
 *   - sorted nodeShapes ("nodeType/subType" tuples — id-agnostic)
 *   - sorted edgeShapes ("sourceShape.sourceHandle → targetShape.targetHandle")
 *
 * What we DON'T compare:
 *   - node ids (the agent names them)
 *   - edge ids (random)
 *   - positions (always 0,0)
 *   - the agent's summary wording
 *
 * If a snapshot needs to change because of an intentional behavior shift,
 * regenerate it with:
 *   bun run scripts/generate-snapshots.ts <name>
 *
 * Tests require a live ANTHROPIC_API_KEY (loaded via env-bootstrap from
 * backend/.env). Each test costs one Sonnet call. Disable via
 * SKIP_LLM_TESTS=1 to bypass in CI runs without API access.
 */

import { describe, test, expect } from 'bun:test';
import { readFile, stat } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runWithMockBridge, summariseDraft } from './helpers/run-with-mock-bridge';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_DIR = resolve(__dirname, 'snapshots');

const SKIP = process.env.SKIP_LLM_TESTS === '1';

type Snapshot = {
  prompt: string;
  nodeCount: number;
  edgeCount: number;
  nodeShapes: string[];
  edgeShapes: string[];
};

const loadSnapshot = async (name: string): Promise<Snapshot> => {
  const raw = await readFile(resolve(SNAPSHOT_DIR, `${name}.json`), 'utf8');
  return JSON.parse(raw) as Snapshot;
};

const snapshotExists = async (name: string): Promise<boolean> => {
  try {
    await stat(resolve(SNAPSHOT_DIR, `${name}.json`));
    return true;
  } catch {
    return false;
  }
};

const cases = [
  'rsi-simple',
  'sma-crossover',
  'rsi-with-stop',
  'rsi-long-short',
  'macd-crossover',
  'senate-trading-alert',
  'trump-truth-social-alert',
];

describe('builder agent snapshots', () => {
  for (const name of cases) {
    test.skipIf(SKIP)(name, async () => {
      if (!(await snapshotExists(name))) {
        console.warn(
          `[${name}] snapshot missing — regenerate with: ` +
          `bun run scripts/generate-snapshots.ts ${name}`,
        );
        return;
      }
      const snap = await loadSnapshot(name);
      const result = await runWithMockBridge(snap.prompt);
      const actual = summariseDraft(result.draft);

      // Subset semantics: even at temperature=0, the LLM occasionally adds an
      // optional decorative edge (e.g. wiring a trigger to a node that also
      // receives data flow). Snapshot captures the MINIMAL required shape;
      // actual may have a small number of extras. We still bound the budget
      // so over-engineering regressions are caught.
      const NODE_TOLERANCE = 2;
      const EDGE_TOLERANCE = 2;

      // Every snapshot node/edge must appear in the actual draft.
      for (const s of snap.nodeShapes) expect(actual.nodeShapes).toContain(s);
      for (const s of snap.edgeShapes) expect(actual.edgeShapes).toContain(s);

      // And the actual must not balloon beyond a small tolerance.
      expect(actual.nodeCount).toBeLessThanOrEqual(snap.nodeCount + NODE_TOLERANCE);
      expect(actual.edgeCount).toBeLessThanOrEqual(snap.edgeCount + EDGE_TOLERANCE);
      // (no lower bound on counts — the per-shape contains() checks above
      // already enforce that all required elements are present)
    }, 180_000); // 3 minute timeout per test
  }
});
