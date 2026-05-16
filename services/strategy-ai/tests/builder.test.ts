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
import { readFile } from 'node:fs/promises';
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

const cases = [
  'rsi-simple',
  'sma-crossover',
  'rsi-with-stop',
  'rsi-long-short',
  'macd-crossover',
];

describe('builder agent snapshots', () => {
  for (const name of cases) {
    test.skipIf(SKIP)(name, async () => {
      const snap = await loadSnapshot(name);
      const result = await runWithMockBridge(snap.prompt);
      const actual = summariseDraft(result.draft);
      expect(actual.nodeCount).toBe(snap.nodeCount);
      expect(actual.edgeCount).toBe(snap.edgeCount);
      expect(actual.nodeShapes).toEqual(snap.nodeShapes);
      expect(actual.edgeShapes).toEqual(snap.edgeShapes);
    }, 180_000); // 3 minute timeout per test
  }
});
