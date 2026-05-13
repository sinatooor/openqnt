#!/usr/bin/env bash
# Rewrite Mach-O install names + LC_RPATH on the bundled Python interpreter
# and any heavyweight native libs (TA-Lib, nautilus_trader Rust extensions)
# so they resolve from inside the bundle rather than from /opt/homebrew.
#
# Idempotent — safe to re-run.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
PY="$REPO/resources/python"
LIBS="$REPO/resources/python-libs"

# Helper: rewrite an absolute or @rpath ref to a path expressed as
# @loader_path/<rel>. We choose @loader_path so each leaf dylib resolves
# relative to its own directory (works even if Python is invoked from an
# unusual cwd).
rewrite_one() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  # Skip non-Mach-O files quickly.
  file -b "$file" | grep -q "Mach-O" || return 0

  # Add @loader_path/. as an rpath if not already present (idempotent).
  install_name_tool -add_rpath "@loader_path/." "$file" 2>/dev/null || true
  install_name_tool -add_rpath "@loader_path/.." "$file" 2>/dev/null || true

  # If this is a dylib itself, set its install_name to its filename only,
  # so consumers can use @rpath/<filename>.
  if [[ "$file" == *.dylib ]] || [[ "$file" == *.so ]]; then
    base="$(basename "$file")"
    install_name_tool -id "@rpath/$base" "$file" 2>/dev/null || true
  fi

  # Rewrite any /opt/homebrew or /usr/local refs to @rpath form. Best-effort.
  # `|| true` on grep is critical: under `set -euo pipefail`, grep returning 1
  # (no matches) kills the whole pipeline, which then kills the script before
  # it even reaches the python-libs walk below. We want a non-match to be a
  # non-event.
  otool -L "$file" 2>/dev/null \
    | tail -n +2 | awk '{print $1}' \
    | { grep -E "^/(opt|usr/local|Users)/" || true; } \
    | while read -r dep; do
        depbase="$(basename "$dep")"
        install_name_tool -change "$dep" "@rpath/$depbase" "$file" 2>/dev/null || true
      done
}

export -f rewrite_one
echo "→ Relocating Mach-O references in $PY/bin/python3 and $LIBS/**/*.{so,dylib}…"

if [[ -f "$PY/bin/python3" ]]; then
  rewrite_one "$PY/bin/python3"
fi

# Walk every .so and .dylib in the bundled site-packages.
find "$LIBS" \( -name "*.so" -o -name "*.dylib" \) -type f -print0 \
  | xargs -0 -I{} bash -c 'rewrite_one "$@"' _ {}

echo "✓ Dylib relocation complete"
