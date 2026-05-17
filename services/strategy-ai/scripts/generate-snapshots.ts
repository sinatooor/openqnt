/**
 * generate-snapshots — Run each baseline prompt against the Builder agent
 * and write the resulting shape signature into tests/snapshots/*.json.
 *
 * Use ONLY to (re)create snapshots after an intentional behavior change.
 * The committed snapshots are the contract; CI compares against them.
 *
 *   bun run scripts/generate-snapshots.ts [name]
 *
 * If `name` is omitted, regenerates all snapshots. Pass a snapshot name
 * (e.g. "rsi-simple") to regenerate just that one.
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runWithMockBridge, summariseDraft } from '../tests/helpers/run-with-mock-bridge';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SNAPSHOT_DIR = resolve(__dirname, '../tests/snapshots');

interface SnapshotSpec {
  name: string;
  prompt: string;
}

const SPECS: SnapshotSpec[] = [
  { name: 'rsi-simple', prompt: 'build an RSI strategy' },
  { name: 'sma-crossover', prompt: 'build an SMA crossover strategy on AAPL' },
  { name: 'rsi-with-stop', prompt: 'build an RSI strategy with a 3% stop loss' },
  { name: 'rsi-long-short', prompt: 'build a long and short RSI strategy: buy when RSI < 30, sell short when RSI > 70' },
  { name: 'macd-crossover', prompt: 'MACD bullish crossover strategy on TSLA' },
  { name: 'senate-trading-alert', prompt: 'every hour, fetch senate trading activity for AAPL and alert me via telegram when a senator buys $50,000 or more' },
  { name: 'trump-truth-social-alert', prompt: 'check Donald Trump\'s Truth Social posts every 10 minutes; if a new post mentions tariffs, China, or the Fed, send me a telegram alert with the post content' },
];

const main = async () => {
  await mkdir(SNAPSHOT_DIR, { recursive: true });
  const target = process.argv[2];
  const specs = target ? SPECS.filter((s) => s.name === target) : SPECS;
  if (specs.length === 0) {
    console.error(`No snapshot matches "${target}". Available: ${SPECS.map((s) => s.name).join(', ')}`);
    process.exit(1);
  }

  for (const spec of specs) {
    console.log(`[${spec.name}] running prompt: ${spec.prompt}`);
    const result = await runWithMockBridge(spec.prompt);
    const snapshot = {
      prompt: spec.prompt,
      ...summariseDraft(result.draft),
    };
    const path = resolve(SNAPSHOT_DIR, `${spec.name}.json`);
    await writeFile(path, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
    console.log(`  wrote ${path}  (${snapshot.nodeCount} nodes, ${snapshot.edgeCount} edges)`);
  }
};

main().catch((err) => {
  console.error('generate-snapshots failed:', err);
  process.exit(1);
});
