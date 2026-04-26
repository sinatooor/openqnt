Here's a full picture of your app and how to run it.

## What your app is

**"Project Prometheus / StrategyFlow"** — a trading strategy platform with 3 layers:

| Layer | Stack | Port |
|---|---|---|
| **Frontend** | React + Vite + TypeScript | `5173` |
| **Python API** | FastAPI (strategy gen, backtesting, AI agents) | `8000` |
| **Orchestrator** | Node/Bun + Express + BullMQ + Prisma | `3000` |

It also needs **Redis** and **PostgreSQL** running for the orchestrator to work fully.

---

## Running locally (4 terminals)

Since you use `conda activate fyer` for your Python environment, here's the full breakdown:

**Terminal 1 — Python backend**
```bash
conda activate fyer
cd /Users/sina/project-fire/fyer/backend
uvicorn main:app --reload --port 8000
```

**Terminal 2 — Frontend**
```bash
cd /Users/sina/project-fire/fyer
bun run dev
```
Opens at `http://localhost:5173`

**Terminal 3 — Orchestrator**
```bash
cd /Users/sina/project-fire/fyer/orchestrator
bun run dev
```

**Terminal 4 — Redis** (required by the orchestrator)
```bash
redis-server
```

---

## Alternatively — Docker (everything at once)

If you prefer not juggling 4 terminals:
```bash
cd /Users/sina/project-fire/fyer
docker-compose up --build
```

This spins up the Python API, orchestrator, Postgres, and Redis together. Add `--profile frontend` if you also want the frontend containerized.

---

## First-time setup notes

- **Python deps:** if you haven't installed them in your `fyer` conda env yet: `pip install -r backend/requirements.txt`
- **Backend env:** `cp backend/.env.example backend/.env` then fill in your API keys (Gemini, DeepSeek, broker creds, etc.)
- **Orchestrator deps:** `cd orchestrator && bun install`
- **DB migration:** `cd orchestrator && bun run db:migrate`
- **Frontend deps:** `bun install` from the root

The FastAPI docs/swagger will be at `http://localhost:8000/docs` once the backend is running.