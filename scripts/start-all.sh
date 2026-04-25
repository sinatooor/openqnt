#!/usr/bin/env bash
# start-all.sh — boot every service the app needs.
#
# What this starts (in this order):
#   1. FastAPI backend  (uvicorn main:app, port 8000) — fyer conda env
#   2. Vite dev server  (npm run dev, port 5173)
#
# What this does NOT start (you start these yourself):
#   • IB TWS / IB Gateway  — desktop app; launch from your dock and log in.
#                            Project default port is 7497 (paper).
#   • Postgres / Redis     — not on the Phase B-J critical path.
#
# Usage:
#   scripts/start-all.sh                 # paper broker (no TWS needed)
#   scripts/start-all.sh ibkr            # use IBKR (TWS must be on :7497)
#   scripts/start-all.sh alpaca          # use Alpaca (env creds required)
#
# Stop with Ctrl-C — both children get SIGTERM.

set -euo pipefail

# ── locate this script's repo root ─────────────────────────────────────
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/.." && pwd)"
cd "$REPO"

# ── pick broker from arg ───────────────────────────────────────────────
BROKER="${1:-paper}"
case "$BROKER" in
  paper)
    # Force paper even if ALPACA_API_KEY / IB env happens to be set in the
    # shell — explicit beats implicit.
    export EXECUTION_BROKER=paper
    ;;
  ibkr)
    export EXECUTION_BROKER=ibkr
    export IB_HOST="${IB_HOST:-127.0.0.1}"
    export IB_PORT="${IB_PORT:-7497}"        # TWS Paper
    export IB_CLIENT_ID="${IB_CLIENT_ID:-42}"
    echo "→ IBKR mode   gateway=$IB_HOST:$IB_PORT  client_id=$IB_CLIENT_ID"
    echo "  (make sure TWS / IB Gateway is running and 'Enable ActiveX and Socket Clients' is on)"
    ;;
  alpaca)
    export EXECUTION_BROKER=alpaca
    : "${ALPACA_API_KEY:?ALPACA_API_KEY must be set for alpaca mode}"
    : "${ALPACA_API_SECRET:?ALPACA_API_SECRET must be set for alpaca mode}"
    echo "→ Alpaca mode (key prefix ${ALPACA_API_KEY:0:2})"
    ;;
  *)
    echo "unknown broker '$BROKER' — use one of: paper, ibkr, alpaca" >&2
    exit 1
    ;;
esac

# ── locate the fyer conda interpreter ──────────────────────────────────
FYER_PY="${FYER_PY:-/opt/miniconda3/envs/fyer/bin/python}"
if [[ ! -x "$FYER_PY" ]]; then
  echo "fyer python not found at $FYER_PY" >&2
  echo "set FYER_PY=/path/to/miniconda3/envs/fyer/bin/python and retry" >&2
  exit 1
fi

# ── child PIDs (cleaned up on Ctrl-C) ─────────────────────────────────
PIDS=()
shutdown() {
  echo
  echo "→ shutting down (PIDs: ${PIDS[*]})"
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap shutdown EXIT INT TERM

# ── 1. backend ─────────────────────────────────────────────────────────
echo "→ backend  python=$FYER_PY  port=8000"
( cd "$REPO/backend" && exec "$FYER_PY" -m uvicorn main:app --port 8000 --reload ) &
PIDS+=($!)

# Give it a couple seconds so the frontend's first requests don't 404.
sleep 2

# ── 2. frontend ────────────────────────────────────────────────────────
echo "→ frontend  npm run dev  port=5173"
( cd "$REPO" && exec npm run dev -- --port 5173 --strictPort ) &
PIDS+=($!)

# ── tail both ──────────────────────────────────────────────────────────
echo
echo "  backend   → http://localhost:8000   (docs at /docs)"
echo "  frontend  → http://localhost:5173"
if [[ "$BROKER" == "ibkr" ]]; then
  echo "  IBKR probe → curl localhost:8000/api/execution/broker/probe"
fi
echo
echo "  Ctrl-C to stop both."
wait
