# BOOT — service startup verification (Phase A1)

Captured: 2026-04-22. Conda env: `fyer` (Python 3.12.12). Bun 1.3.10. Node 22.13.1.

## How to boot all three services

```bash
# Terminal 1 — backend (FastAPI)
source /opt/miniconda3/etc/profile.d/conda.sh && conda activate fyer
cd backend && uvicorn main:app --port 8000 --host 127.0.0.1

# Terminal 2 — frontend (Vite)
cd /Users/sina/project-fire/fyer
bun dev                    # → http://localhost:5173

# Terminal 3 — orchestrator (Bun + Express + Socket.io)
cd /Users/sina/project-fire/fyer/orchestrator
bun --watch src/index.ts   # → http://localhost:3000
```

## Boot results

| Service | Port | Boots | Notes |
|---|---|---|---|
| Backend (FastAPI) | 8000 | ✅ | `Uvicorn running on http://127.0.0.1:8000` |
| Frontend (Vite) | 5173 | ✅ | `VITE v7.2.7 ready in 298 ms` |
| Orchestrator (Bun) | 3000 | ✅ | `health` returns 200; protected routes return 401 (expected) |

## Warnings / known boot-time noise

### Backend
- `BLOCK_CATALOG.xml` not found at the working dir → `BlockLibrary` falls back to a 7-block default. Non-fatal, but block coverage is partial.
- `backend/prompts/system_prompt.txt` and `rationalization_prompt.txt` not found → the strategy generator runs without them. Non-fatal but reduces quality.
- `backend/llm_service.py:66` — Pydantic warning: field name `schema` shadows BaseModel attribute. Cosmetic.
- `market_data_scheduler` starts on import and immediately fetches forex bars. This means importing `main.py` for any reason (tests, scripts) triggers network I/O. Worth gating behind a startup flag.

### Orchestrator
- `Redis reconnecting...` repeats every ~200ms. **Redis is not running locally.** Several features (BullMQ workers, rate limiting) will silently degrade. Must run `redis-server` locally or skip orchestrator-backed flows during dev.
- Bull-board admin UI at `http://localhost:3000/admin/queues` returns 200 but worker queues are empty.

### Frontend
- Clean boot. No console errors at startup (HTTP-only check; runtime React errors not yet validated — see AUDIT.md A3).

## Two `.env` files exist — important

The repo has **two** `.env` files. Both are loaded depending on the service:
- `/.env` — root, read by Vite (frontend) and shell.
- `/backend/.env` — read by `python-dotenv` when running uvicorn from `backend/`.

`backend/.env` contains additional keys not in root `.env`: `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`, `IG_API_KEY`/`IG_USERNAME`/`IG_PASSWORD`/`IG_ACCOUNT_TYPE`, `AI_GATEWAY_API_KEY`. The PLAN.md inventory understated the env coverage — see AUDIT.md A6 for the corrected matrix.

## Next-time-boot checklist

- [ ] `redis-server` running before starting orchestrator.
- [ ] Run uvicorn from `backend/` (not repo root) so dotenv finds `backend/.env`.
- [ ] If you want a quiet boot, gate the market-data scheduler on `MARKET_SCHEDULER_ENABLED=1`.
