#!/usr/bin/env bash
# Compile the Bun/TypeScript orchestrator into a single executable per arch
# using `bun build --compile`. Output: resources/orchestrator-arm64 and
# resources/orchestrator-x64.
#
# Also copies the Prisma query engines into resources/orchestrator-engines/
# so the compiled binary can locate them via PRISMA_QUERY_ENGINE_BINARY.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
ORCH="$REPO/orchestrator"
OUT="$REPO/resources"
ENGINES_OUT="$OUT/orchestrator-engines"

mkdir -p "$OUT" "$ENGINES_OUT"

cd "$ORCH"

echo "→ Installing orchestrator deps…"
bun install --frozen-lockfile || bun install

echo "→ Generating Prisma client…"
bun run prisma generate

# Build-time: generate canonical creation SQL from schema.prisma so the
# desktop orchestrator can bootstrap the embedded Postgres on first launch
# without needing the Prisma CLI at runtime. Wrapped in a TS module so
# `bun build --compile` embeds it inside the single binary.
echo "→ Generating desktop schema bootstrap…"
bun run prisma migrate diff \
  --from-empty \
  --to-schema-datamodel ./prisma/schema.prisma \
  --script > /tmp/openqnt-schema.sql

if [[ ! -s /tmp/openqnt-schema.sql ]]; then
  echo "  ✗ prisma migrate diff produced no output — desktop schema bootstrap will be skipped" >&2
else
  # Assemble the TS module via Node — JSON.stringify guarantees safe escaping
  # for any characters in the SQL (quotes, backticks, backslashes).
  node -e "
    const fs = require('node:fs');
    const sql = fs.readFileSync('/tmp/openqnt-schema.sql', 'utf8');
    const body = [
      '// AUTO-GENERATED at bundle time from prisma/schema.prisma via',
      '// prisma migrate diff --from-empty. DO NOT EDIT BY HAND.',
      '// Used by index.ts to bootstrap the embedded Postgres on first launch.',
      'export const DESKTOP_SCHEMA_SQL = ' + JSON.stringify(sql) + ';',
      '',
    ].join('\n');
    fs.writeFileSync('src/services/desktopSchema.ts', body);
  "
  echo "  ✓ src/services/desktopSchema.ts ($(wc -c < src/services/desktopSchema.ts | tr -d ' ') bytes, $(wc -l < /tmp/openqnt-schema.sql | tr -d ' ') SQL lines)"
fi

echo "→ Compiling orchestrator (arm64)…"
bun build --compile --target=bun-darwin-arm64 \
  src/index.ts \
  --outfile "$OUT/orchestrator-arm64"

echo "→ Compiling orchestrator (x64)…"
bun build --compile --target=bun-darwin-x64 \
  src/index.ts \
  --outfile "$OUT/orchestrator-x64"

# Copy Prisma engine binaries — Bun's compile doesn't bundle these as native
# binaries; they're loaded from the filesystem at runtime.
echo "→ Copying Prisma engines…"
NM="$ORCH/node_modules"
if [[ -d "$NM/.prisma/client" ]]; then
  rsync -a --include="*-darwin*" --include="libquery_engine*" \
        --exclude="*" \
        "$NM/.prisma/client/" "$ENGINES_OUT/" 2>/dev/null || true
fi
if [[ -d "$NM/@prisma/engines" ]]; then
  rsync -a "$NM/@prisma/engines/" "$ENGINES_OUT/@prisma-engines/" 2>/dev/null || true
fi

echo "✓ Orchestrator bundle ready: $OUT/orchestrator-{arm64,x64}"
ls -lh "$OUT/orchestrator-arm64" "$OUT/orchestrator-x64" 2>/dev/null || true
