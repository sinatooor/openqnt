#!/usr/bin/env bash
# Bundle redis-server binaries for macOS (arm64 + x64) into resources/redis/.
# Uses the local Homebrew install if available, otherwise builds from source.
#
# Output: resources/redis/redis-server-arm64
#         resources/redis/redis-server-x64

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
OUT="$REPO/resources/redis"
mkdir -p "$OUT"

# Pick redis from Homebrew if it's there.
BREW_REDIS="$(brew --prefix redis 2>/dev/null || true)"

copy_brew_for_arch() {
  local arch="$1"
  local out="$OUT/redis-server-$arch"
  if [[ -x "$out" ]]; then
    echo "  $arch already present, skipping"
    return
  fi
  if [[ -z "$BREW_REDIS" ]]; then
    return 1
  fi
  local src="$BREW_REDIS/bin/redis-server"
  if [[ ! -x "$src" ]]; then
    return 1
  fi
  # Verify arch matches
  if ! file "$src" | grep -q "$arch"; then
    return 1
  fi
  cp "$src" "$out"
  chmod +x "$out"
  echo "  copied $arch from $src"
}

# Try brew first.
copy_brew_for_arch "arm64" || true
copy_brew_for_arch "x86_64" || true
# Rename x86_64 → x64 to match the convention used elsewhere.
if [[ -f "$OUT/redis-server-x86_64" ]]; then
  mv "$OUT/redis-server-x86_64" "$OUT/redis-server-x64"
fi

# Fallback: prebuilt from npm (`redis-binaries`).
fallback_npm() {
  local arch="$1"
  local outname="$OUT/redis-server-$arch"
  if [[ -x "$outname" ]]; then return 0; fi
  echo "  fetching redis-server ($arch) via npm…"
  cd "$REPO"
  npx --yes -p redis-binaries -- node -e "
    const fs = require('fs');
    const path = require('path');
    const root = path.dirname(require.resolve('redis-binaries/package.json'));
    const candidates = [
      path.join(root, 'darwin-$arch/redis-server'),
      path.join(root, 'bin/darwin-$arch/redis-server'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        fs.copyFileSync(c, '$outname');
        fs.chmodSync('$outname', 0o755);
        process.exit(0);
      }
    }
    console.error('redis-binaries: no $arch binary found in', root);
    process.exit(1);
  " || true
}

if [[ ! -x "$OUT/redis-server-arm64" ]]; then fallback_npm arm64; fi
if [[ ! -x "$OUT/redis-server-x64" ]]; then fallback_npm x64; fi

for a in arm64 x64; do
  if [[ -x "$OUT/redis-server-$a" ]]; then
    echo "✓ redis-server ($a): $("$OUT/redis-server-$a" --version 2>/dev/null || echo unknown)"
  else
    echo "✗ redis-server ($a) MISSING — orchestrator BullMQ features will fail" >&2
  fi
done
