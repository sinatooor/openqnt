# 2026-05-08 — Mobile companion + desktop wrapper

This session shipped three coupled work streams that together turn OpenQnt
from a web-only stack into a desktop-first product with a native iOS
companion:

1. A SwiftUI **iOS app** that mirrors the desktop experience for portfolio,
   markets, agents, chat, risk, and notifications.
2. A backend **APNs alert pipeline** that feeds the iOS app's notification
   feed and banner pushes (separate from the existing VoIP / CallKit pushes
   used for incoming agent calls).
3. An **Electron desktop wrapper** that supervises Postgres, Redis, the
   Python backend, and the Node orchestrator inside a single .app — plus
   the runtime URL config refactor that makes a packaged build work
   without baked-in localhost URLs.

The work landed as three commits on top of `efac9ff`:

| Commit    | Subject                                                        |
|-----------|----------------------------------------------------------------|
| `28814dc` | feat(ios-push): APNs alerts router for trade/risk/strategy events |
| `326c94c` | feat(ios): SwiftUI mobile companion app                        |
| `fdac484` | feat(desktop): Electron wrapper, runtime URL config, fear-greed index |

---

## 1. Mobile companion (iOS)

`ios-app/OpenQnt/` — 36 new Swift files plus tweaks to `AppDelegate.swift`
and `OpenQntApp.swift`. Native SwiftUI, no third-party UI deps.

**Networking layer.** `Networking/APIClient.swift` is a typed HTTP client
(GET/POST/PATCH/DELETE) with automatic auth-header injection and a
snake_case ↔ camelCase JSON codec to match backend conventions. JWT auth
lives in `AuthClient.swift` — access + refresh tokens are stored in the
**iOS Keychain** (not UserDefaults), and 401 responses transparently
trigger a refresh-then-replay. `WebSocketClient.swift` provides
exponential-backoff reconnect (capped at 30 s) for live quote streams and
streaming AI chat.

**State.** Seven `@MainActor` ObservableObject stores under `Stores/`:
`AuthStore`, `PortfolioStore` (polling snapshots + equity history),
`QuotesStore` (live WS), `ChatStore` (streaming AI), `AgentsStore`
(strategy run history + boss-agent state), `RiskStore` (limits + panic
controls), `NotificationsStore` (alert feed + APNs token registration).

**UI sections** (`UI/`): Auth (Login, Register), Dashboard (equity curve),
Markets (watchlist, symbol detail, candle charts with timeframe picker),
Portfolio (positions, position detail), Agents (run list, boss runs),
Chat (AI assistant with streaming bubbles), Risk (limits panel, panic
button), Notifications (alert feed). `RootTabView.swift` wires them up.

**Push.** Two pipelines coexist:

- **VoIP / CallKit / PushKit** for incoming agent voice calls — already
  shipped previously and routes through the backend `voice` router.
- **APNs (standard banners)** for trade/risk/strategy alerts — new this
  session, routes through `backend/routers/ios_push.py` (see §2).

The app registers each device token with the matching backend endpoint at
sign-in.

## 2. Backend APNs alerts (`backend/routers/ios_push.py`)

A small standalone router with three endpoints:

| Method | Path                       | Purpose                            |
|--------|----------------------------|------------------------------------|
| POST   | `/ios-push/register`       | Register an APNs device token      |
| GET    | `/ios-push/feed`           | Paginated alert history            |
| POST   | `/ios-push/{id}/read`      | Mark a feed entry read             |

Storage: two SQLite tables — `ios_devices_alerts` (device token per user)
and `notifications_feed` (history rows the iOS NotificationsStore reads).

The router exposes a `push_alert(...)` helper that other routers
(execution, risk, boss) can call fire-and-forget. APNs delivery is
**best-effort** — if the push fails we log it but never propagate the
failure into the parent trade/alert flow.

Wired into `backend/main.py` between the voice-router registration and
the integrations-router registration.

## 3. Electron desktop wrapper (`electron/`)

The goal: ship OpenQnt as a single `.app` for users who don't want to run
`scripts/start-all.sh` and a Vite dev server by hand.

**Supervisor lifecycle.** `services/supervisor.ts` brings up the four
processes in order: Postgres → Redis → Python backend (FastAPI) → Node
orchestrator. Each child has restart-on-crash with a 3-retry-per-60s
budget. Quitting the app drives the reverse-order graceful shutdown.

**Splash screen.** `splash.html` is a small Electron BrowserWindow that
shows boot progress, streams per-service logs in real time (1000-line
in-memory ring buffer in `lib/logger.ts`), and exposes a "reveal logs"
action that opens `userData/logs/` in Finder.

**Custom protocol.** `app://` is registered to serve the bundled SPA off
disk; non-asset paths fall back to `index.html` so client-side routing
works. The renderer never touches `http://localhost` for static assets.

**Preload bridge.** `preload.ts` exposes `window.electronAPI` with the
live URLs (backend, orchestrator, WebSocket). Critically these are passed
in via `additionalArguments` so they are **synchronously available at
module load** — the renderer's `apiBase()` is called from imports during
first render, so it can't be async.

**Packaging.** `electron-builder.yml` produces an arm64 `.app`. The
bundled tree under `resources/` (Python interpreter, Postgres, Redis,
orchestrator binary, frontend dist) lives outside `asar` so signed
binaries stay valid. `scripts/relocate-dylibs.sh` rewrites mach-o
load-paths post-build so the embedded native libraries load against the
bundled Postgres/Python rather than `/usr/local`.

**Dev mode.** `electron .. --dev` skips spawning local services and just
opens a window pointing at the existing `localhost:8000` / `localhost:3000`
dev stack. Useful for working on the Electron shell without rebuilding
the bundle.

## 4. Runtime URL config refactor

The problem: `import.meta.env.VITE_BACKEND_URL` is **inlined by Vite at
build time**. A packaged Electron build can't pick a free port at runtime
and have the renderer use it, because the URL was already baked into the
JS bundle.

**Fix.** `src/lib/runtimeConfig.ts` exposes `apiBase()`,
`orchestratorBase()`, `wsBase()`, and `isDesktop()`. Each resolves in
this order:

1. `window.electronAPI.<x>Url` — the URL the supervisor picked at boot
2. `import.meta.env.VITE_<X>_URL` — Vite-inlined dev/web build value
3. Hardcoded `localhost:*` fallback

`scripts/codemod-runtime-urls.ts` is a one-shot codemod that rewrote
every direct `import.meta.env.VITE_*_URL` reference across services,
features, pages, stores, hooks, and integrations (~70 files). The
expectation going forward is that **no other file reads
`import.meta.env.VITE_*_URL` directly** — an ESLint rule (in
`eslint.config.js`) enforces this.

## 5. Backend desktop-mode adaptations

The bundled `resources/backend` tree is read-only (it's inside the signed
`.app`). All writable state needs to move under a user-data dir. The
pattern: each module reads `OPENQWNT_DATA_DIR`, falling back to its
existing in-tree path so `scripts/start-all.sh` keeps working unchanged.

| Module                                | Writable artifact                         |
|---------------------------------------|-------------------------------------------|
| `agent_runtime/storage.py`            | `agents/` (per-run state)                 |
| `local_database.py`                   | `strategies.db`                           |
| `llm_logger.py`                       | `logs/`                                   |
| `dynamic_tools/registry.py`           | `agents/tools/dynamic`                    |
| `improvement/tree.py`                 | `agents/boss/runs`                        |
| `vector_rag.py`                       | `chroma_db_v2`                            |
| `strategy_flow/dynamic_prompt.py`     | `node_catalog_cache.json` (read-only seed → user-data copy on first run) |

`backend/main.py` also gets two desktop-aware switches:

- `OPENQWNT_DESKTOP_MODE=true` skips the 5-minute market-data scheduler.
  Many users are on residential IPs; the scheduler hammering yfinance
  every 5 min trips rate limits and isn't useful for a single-user
  desktop session.
- CORS adds `app://localhost` and `"null"` (from `file://`) to the allow
  list, plus a permissive allow-all path when desktop-mode is set (the
  backend binds 127.0.0.1 in that mode, so it's safe).

## 6. Other improvements

**`/fear-greed` endpoint** — added to `backend/routers/terminal_data.py`.
A CNN-style Fear & Greed index (0–100) computed from a single yfinance
batch download (~6 months of daily bars for SPY, RSP, ^VIX, TLT, HYG,
LQD). Six components are averaged: momentum, strength, breadth,
volatility, safe-haven demand, junk-bond demand. Each is clamped and
linearly mapped from a fear/greed threshold pair to `[0, 100]`. Replaces
the stub data the dashboard's `MarketPulsePanel` previously displayed.
Cheap enough to poll every minute.

## 7. Build & test notes

- **Desktop**: `bun run electron:dist` produces an arm64 `.app` under
  `release/`. Both `release/` and `resources/` are now `.gitignore`d (the
  former holds the final `.dmg` / `.zip`, the latter the staged tree the
  packager copies into the .app).
- **Frontend**: `bun run build` should still succeed — the codemod
  rewrote all known `VITE_*_URL` call sites, but the build will catch
  any miss. Lint enforces the same.
- **iOS**: builds in Xcode against the backend reachable on the device's
  LAN IP. `Networking/Endpoints.swift` is the single place to point the
  app at a different host.
- **First-launch desktop**: `dynamic_prompt.py` seeds
  `node_catalog_cache.json` from the read-only bundle into the
  user-data dir on first run, then writes there from then on.

## 8. Known gaps / follow-ups

- **x64 build** not yet produced — `electron-builder` is configured for
  `--mac` arm64 only. Add an x64 (or universal) target before shipping
  to non-Apple-Silicon users.
- **APNs certs** — the iOS push router currently runs against the dev
  /sandbox APNs environment. Production rollout needs production APNs
  certs and a config flag.
- **Stale tracked files** — `backend/database/__pycache__/models.cpython-312.pyc`
  and `backend/strategies.db` are still tracked from before they were
  added to `.gitignore`. They show as modified after every backend run.
  A follow-up `git rm --cached` would clean this up.
- **Bundle size** — `release/` is ~1.7 GB (DMG + ZIP + unpacked app),
  driven mostly by the embedded Python interpreter and `python-libs/`.
  Worth a pruning pass before public release.
