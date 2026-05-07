#!/usr/bin/env bash
# Bundle a relocatable CPython 3.12 + every backend dep into resources/python +
# resources/python-libs. Pre-downloads the sentence-transformers MPNet model
# into resources/models. Compiles all .py to .pyc and removes source.
#
# Run on macOS once per arch you ship. For universal2 builds, run twice and
# merge with `lipo` for the python interpreter (binaries inside python-libs
# need their own arch-specific install — use `pip install --platform`).
#
# Output: resources/python/, resources/python-libs/, resources/models/

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"
cd "$REPO"

ARCH="${BUNDLE_ARCH:-$(uname -m)}"
case "$ARCH" in
  arm64|aarch64) PBS_ARCH="aarch64-apple-darwin" ;;
  x86_64|amd64)  PBS_ARCH="x86_64-apple-darwin" ;;
  *) echo "unsupported arch: $ARCH" >&2; exit 1 ;;
esac

# Pin to a known-good python-build-standalone release (May 2026, CPython 3.12.13).
PY_VER="3.12.13"
PBS_REL="20260504"
PBS_URL="https://github.com/astral-sh/python-build-standalone/releases/download/${PBS_REL}/cpython-${PY_VER}+${PBS_REL}-${PBS_ARCH}-install_only.tar.gz"

OUT_PYTHON="resources/python"
OUT_LIBS="resources/python-libs"
OUT_MODELS="resources/models"

mkdir -p "$OUT_PYTHON" "$OUT_LIBS" "$OUT_MODELS"

# 1. Download + extract CPython
if [[ ! -x "$OUT_PYTHON/bin/python3" ]]; then
  echo "→ Downloading CPython ${PY_VER} (${PBS_ARCH})…"
  TMP="$(mktemp -d)"
  curl -fL --retry 3 -o "$TMP/python.tar.gz" "$PBS_URL"
  tar -xzf "$TMP/python.tar.gz" -C "$TMP"
  # The archive contains a "python/" directory; strip it.
  rsync -a --delete "$TMP/python/" "$OUT_PYTHON/"
  rm -rf "$TMP"
fi

PY_BIN="$OUT_PYTHON/bin/python3"
"$PY_BIN" --version

# 2. Install uv into the bundled Python (faster, handles --target reliably)
"$PY_BIN" -m pip install --upgrade pip
"$PY_BIN" -m pip install --upgrade uv

# 3. Install backend dependencies into python-libs.
#    Strategy: install in two waves —
#      (a) "must-have" core deps that crash the backend at import time if missing
#      (b) "nice-to-have" optional deps that the backend already runtime-gates
#    A single failure in wave (b) shouldn't kill the bundle.
echo "→ Installing core backend deps into $OUT_LIBS (resilient mode)…"

# Filter the requirements.txt — drop deps that need system C libs we don't ship
# and aren't on the critical path for the desktop demo. Friends can still run
# 99% of features; advanced indicators (TA-Lib) and Nautilus engine fall back.
SKIP_PATTERN='^(TA-Lib|nautilus_trader|chromadb|sentence-transformers)\b'

awk -v skip="$SKIP_PATTERN" '
  /^#/ || /^$/ { next }
  $0 ~ skip   { next }
  { print }
' backend/requirements.txt > /tmp/openqnt-requirements.txt

cat /tmp/openqnt-requirements.txt

"$PY_BIN" -m uv pip install \
  --python "$PY_BIN" \
  --target "$OUT_LIBS" \
  --no-cache \
  -r /tmp/openqnt-requirements.txt

# 4. Try the heavy/optional deps individually so one failure doesn't poison
#    the whole bundle. The backend gates each of these at runtime.
echo "→ Trying optional deps (best-effort)…"
for opt in \
  "TA-Lib" \
  "nautilus_trader" \
  "chromadb" \
  "sentence-transformers" \
  "aioapns" "twilio" "phonenumbers" "pyotp"; do
  echo "  trying $opt…"
  "$PY_BIN" -m uv pip install \
    --python "$PY_BIN" \
    --target "$OUT_LIBS" \
    --no-cache \
    "$opt" 2>&1 | tail -3 || echo "  ⚠ $opt skipped — feature will degrade at runtime"
done

# 5. Pre-downloading the sentence-transformers MPNet model is optional and
#    adds ~400MB. Set OPENQNT_BUNDLE_RAG_MODEL=1 to include it. Default: skip
#    (RAG is gated behind a feature flag in the backend anyway).
if [[ "${OPENQNT_BUNDLE_RAG_MODEL:-0}" == "1" ]]; then
  echo "→ Pre-downloading sentence-transformers/all-mpnet-base-v2…"
  HF_HOME="$REPO/$OUT_MODELS/hf-cache" \
  SENTENCE_TRANSFORMERS_HOME="$REPO/$OUT_MODELS" \
  PYTHONPATH="$REPO/$OUT_LIBS" \
    "$PY_BIN" -c "
from sentence_transformers import SentenceTransformer
m = SentenceTransformer('all-mpnet-base-v2')
m.save('$REPO/$OUT_MODELS/all-mpnet-base-v2')
print('saved.')
" || echo "   (skipped — sentence-transformers not installed; RAG will be unavailable)"
else
  echo "→ Skipping MPNet model download (set OPENQNT_BUNDLE_RAG_MODEL=1 to include)"
fi

# 6. Strip junk that bloats the bundle without changing behaviour:
#    pip caches, vendored tests, old wheels.
echo "→ Stripping caches and tests…"
find "$OUT_LIBS" -type d -name "__pycache__" -prune -exec rm -rf {} + 2>/dev/null || true
find "$OUT_LIBS" -type d \( -name "tests" -o -name "test" \) -prune -exec rm -rf {} + 2>/dev/null || true
find "$OUT_LIBS" -type f -name "*.pyc" -delete 2>/dev/null || true
rm -rf "$OUT_LIBS"/pip "$OUT_LIBS"/uv 2>/dev/null || true

# 7. Optional: compile .py → .pyc and remove .py source (raises the bar past
#    casual inspection; not real protection — bytecode IS decompilable). Many
#    libraries use __file__ to load adjacent resources, so this is risky for
#    a first build. Default: keep .py source. Set OPENQNT_BYTECODE_ONLY=1 to
#    enable.
if [[ "${OPENQNT_BYTECODE_ONLY:-0}" == "1" ]]; then
  echo "→ Compiling .py → .pyc and removing source (OPENQNT_BYTECODE_ONLY=1)…"
  "$PY_BIN" -m compileall -b -q "$OUT_LIBS" || true
  find "$OUT_LIBS" -name "*.py" -type f | while read -r f; do
    if [[ -f "${f%.py}.pyc" ]]; then
      rm "$f"
    fi
  done
  find "$OUT_LIBS" -type d -empty -delete 2>/dev/null || true
else
  echo "→ Keeping .py source (set OPENQNT_BYTECODE_ONLY=1 to compile to bytecode)"
fi

# 8. Relocate dylibs (TA-Lib, nautilus_trader Rust libs, etc.) so they resolve
#    from the bundle's library path under @executable_path.
if [[ -x "$HERE/relocate-dylibs.sh" ]]; then
  echo "→ Relocating dylibs…"
  bash "$HERE/relocate-dylibs.sh"
fi

du -sh "$OUT_PYTHON" "$OUT_LIBS" "$OUT_MODELS" 2>/dev/null || true
echo "✓ Python bundle ready under resources/"
