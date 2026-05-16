/**
 * extract-handle-configs — Generate a JSON map of handle topology for every
 * catalog node, sourced from the frontend's `getHandleConfigs`.
 *
 * Output: backend/strategy_flow/handle_configs.json
 *   {
 *     "indicator/rsi": [{id, type, position, label, dataType}, ...],
 *     "trigger/heartbeatTrigger": [...],
 *     ...
 *   }
 *
 * Why this script exists: the Python catalog endpoint can't run TypeScript,
 * but the canonical handle topology lives in a TS file
 * (`src/features/strategy-flow/utils/handleUtils.ts`). This script bridges the
 * two — it imports that TS file directly via Bun and writes the resolved
 * handles per `(nodeType, subType)` pair so Python can attach them at serve
 * time. Run it as part of the build pipeline (or any time the frontend
 * handle topology changes).
 *
 * Single source of truth: frontend handleUtils.ts. The strategy-ai service no
 * longer keeps its own copy.
 *
 * Usage: bun run scripts/extract-handle-configs.ts
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getHandleConfigs, type HandleConfig } from '../src/features/strategy-flow/utils/handleUtils';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const CATALOG_CACHE = resolve(REPO_ROOT, 'backend/strategy_flow/node_catalog_cache.json');
const OUT_PATH = resolve(REPO_ROOT, 'backend/strategy_flow/handle_configs.json');

type CatalogNode = {
  type: string;
  nodeType: string;
  defaultData?: Record<string, unknown>;
};

const SUBTYPE_KEYS = [
  'indicatorType', 'conditionType', 'actionType', 'triggerType',
  'mathType', 'controlType', 'riskType', 'variableType',
  'environmentType', 'tradeInfoType', 'llmType', 'integrationType',
  'pineType', 'agentType', 'provider',
];

const extractSubType = (n: CatalogNode): string | undefined => {
  const data = n.defaultData ?? {};
  for (const k of SUBTYPE_KEYS) {
    const v = (data as Record<string, unknown>)[k];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  // Fall back to the catalog `type` field (for nodes like startTrigger that
  // serve as their own subType discriminator).
  return n.type;
};

const main = async () => {
  const raw = await readFile(CATALOG_CACHE, 'utf8');
  const catalog = JSON.parse(raw) as Record<string, CatalogNode[]>;

  const out: Record<string, HandleConfig[]> = {};
  let count = 0;
  let skipped = 0;

  for (const nodes of Object.values(catalog)) {
    if (!Array.isArray(nodes)) continue;
    for (const n of nodes) {
      const subType = extractSubType(n);
      const handles = getHandleConfigs(n.nodeType, subType);
      // Key by both the (nodeType, subType) pair AND the catalog `type` so
      // either lookup works on the Python side without needing to compute the
      // subType again.
      const pairKey = `${n.nodeType}/${subType ?? n.type}`;
      out[pairKey] = handles;
      out[n.type] = handles;
      if (handles.length === 0) {
        skipped++;
      } else {
        count++;
      }
    }
  }

  await writeFile(OUT_PATH, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${Object.keys(out).length} entries to ${OUT_PATH}`);
  console.log(`  with handles: ${count}, empty (unknown nodeType): ${skipped}`);
};

main().catch((err) => {
  console.error('extract-handle-configs failed:', err);
  process.exit(1);
});
