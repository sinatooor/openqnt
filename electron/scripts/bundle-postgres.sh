#!/usr/bin/env bash
# Bundle PostgreSQL binaries for macOS into resources/postgres/<arch>/.
# Uses npm's @embedded-postgres/darwin-{arm64,x64} which ship `initdb`,
# `pg_ctl`, and `postgres` only — `pg_isready`/`createdb`/`psql` are NOT
# included. Our services/postgres.ts uses TCP polling for readiness and
# postgres single-user mode for the initial CREATE DATABASE, so we don't
# need them.
#
# Output: resources/postgres/arm64/{bin,lib,share}
#         resources/postgres/x64/{bin,lib,share}    (only if BUNDLE_BOTH_ARCH=1)

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
OUT="$REPO/resources/postgres"
mkdir -p "$OUT"

# embedded-postgres-binaries package names by arch:
#   @embedded-postgres/darwin-arm64
#   @embedded-postgres/darwin-x64

extract() {
  local arch="$1"             # "arm64" or "x64"
  local pkg="@embedded-postgres/darwin-${arch}"
  local dest="$OUT/$arch"
  if [[ -x "$dest/bin/postgres" ]]; then
    echo "  $arch already present, skipping"
    return 0
  fi

  echo "  fetching $pkg → $dest"
  local tmp; tmp="$(mktemp -d)"
  pushd "$tmp" > /dev/null
  npm pack "$pkg" --silent
  local tgz; tgz="$(ls *.tgz | head -1)"
  if [[ -z "$tgz" ]]; then
    echo "  ✗ npm pack produced no tarball" >&2
    popd > /dev/null
    return 1
  fi
  tar -xzf "$tgz"
  # Tarball layout: package/native/{bin,lib,share}/...
  mkdir -p "$dest"
  cp -R package/native/bin "$dest/bin"
  cp -R package/native/lib "$dest/lib"
  cp -R package/native/share "$dest/share"
  popd > /dev/null
  rm -rf "$tmp"

  # Create the SONAME symlinks the postgres binary + extensions expect.
  # The package ships e.g. libzstd.1.5.7.dylib but the binary's @loader_path
  # references are to libzstd.1.dylib. We scan every @loader_path reference
  # across postgres + every shipped extension, then create a symlink from
  # the referenced name to a matching versioned file (when one exists).
  pushd "$dest/lib" > /dev/null
  needed=$(
    find "$dest/bin" "$dest/lib" -type f \( -name "*.dylib" -o -perm -u+x \) \
      -print0 2>/dev/null \
      | xargs -0 -I{} otool -L "{}" 2>/dev/null \
      | grep -oE "@loader_path/\.\./lib/[A-Za-z0-9_+\-][A-Za-z0-9_+.\-]*\.dylib" \
      | awk -F/ '{print $NF}' \
      | sort -u
  )
  for ref in $needed; do
    [[ -e "$ref" ]] && continue
    base="${ref%.dylib}"
    # Try progressively longer numeric suffixes: libzstd.1 → libzstd.1.5.7
    target=""
    for cand in "$base".*.dylib "${base%.*}".*.dylib; do
      if [[ -e "$cand" ]]; then
        target="$cand"
        break
      fi
    done
    if [[ -n "$target" ]]; then
      ln -sf "$target" "$ref"
    fi
  done
  popd > /dev/null

  if [[ ! -x "$dest/bin/postgres" ]]; then
    echo "  ✗ $arch postgres binary missing after extract" >&2
    return 1
  fi
  echo "  ✓ $arch: $("$dest/bin/postgres" --version 2>&1 | head -1)"
}

# Default: build for whatever arch the current Mac is. Set BUNDLE_BOTH_ARCH=1
# to build both for a universal2 DMG.
HOST_ARCH="$(uname -m)"
case "$HOST_ARCH" in
  arm64) DEFAULT_ARCH="arm64" ;;
  x86_64) DEFAULT_ARCH="x64" ;;
  *) echo "unsupported host arch: $HOST_ARCH" >&2; exit 1 ;;
esac

if [[ "${BUNDLE_BOTH_ARCH:-0}" == "1" ]]; then
  extract arm64
  extract x64
else
  extract "$DEFAULT_ARCH"
fi

echo "✓ Postgres bundle ready under $OUT"
