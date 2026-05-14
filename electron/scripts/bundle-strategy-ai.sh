#!/usr/bin/env bash
# Compile the Bun/TypeScript strategy-ai sidecar (services/strategy-ai/) into
# a single executable per arch using `bun build --compile`.
# Output: resources/strategy-ai-arm64 (and resources/strategy-ai-x64 when
# BUNDLE_BOTH_ARCH=1 is set).
#
# The sidecar runs the n8n-inspired Builder agent (Vercel AI SDK + Anthropic)
# and exposes POST /agent/run via SSE. In the packaged desktop app it is
# spawned by electron/services/strategy-ai.ts and consumed by the Python
# backend at STRATEGY_AI_URL (passed in env).

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
SRC="$REPO/services/strategy-ai"
OUT="$REPO/resources"

mkdir -p "$OUT"

cd "$SRC"

echo "→ Installing strategy-ai deps…"
bun install --frozen-lockfile || bun install

echo "→ Compiling strategy-ai (arm64)…"
bun build --compile --target=bun-darwin-arm64 \
  src/index.ts \
  --outfile "$OUT/strategy-ai-arm64"

# Universal build is opt-in to keep CI/dev fast; arm64 is the only target
# shipped today (matches the orchestrator + postgres bundle policy).
if [[ "${BUNDLE_BOTH_ARCH:-}" == "1" ]]; then
  echo "→ Compiling strategy-ai (x64)…"
  bun build --compile --target=bun-darwin-x64 \
    src/index.ts \
    --outfile "$OUT/strategy-ai-x64"
fi

echo "✓ strategy-ai bundle complete:"
ls -lh "$OUT"/strategy-ai-* 2>/dev/null
