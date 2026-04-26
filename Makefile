# =============================================================================
# Shortcuts. Run `make` (or `make help`) for the menu.
# Anything unprefixed targets the current dev shell; `docker-*` targets the
# compose stack.
# =============================================================================

.DEFAULT_GOAL := help
SHELL := /bin/bash

# Pick up .env so EXECUTION_BROKER / ALPACA_*/ etc. flow through.
-include .env
export

# ── help ──────────────────────────────────────────────────────────────
.PHONY: help
help:	## show this menu
	@awk 'BEGIN {FS = ":.*## "; printf "Usage: make <target>\n\nTargets:\n"} \
		/^[a-zA-Z0-9_-]+:.*?## / { printf "  %-22s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

# ── local (no docker) ─────────────────────────────────────────────────
.PHONY: dev
dev:	## start backend + frontend locally (uses fyer conda env)
	scripts/start-all.sh paper

.PHONY: dev-ibkr
dev-ibkr:	## same as `dev` but route trades to TWS on 127.0.0.1:7497
	scripts/start-all.sh ibkr

.PHONY: test
test:	## run all backend pytest suites
	cd backend && /opt/miniconda3/envs/fyer/bin/python -m pytest tests/ -q

.PHONY: e2e
e2e:	## run Playwright (needs backend on :8000 + chromium)
	npm run e2e

# ── docker (dev compose) ──────────────────────────────────────────────
.PHONY: docker-up
docker-up:	## bring up backend + frontend (dev targets, hot reload)
	docker compose up --build -d
	@echo
	@echo "  backend   → http://localhost:8000   (docs at /docs)"
	@echo "  frontend  → http://localhost:5173"
	@echo "  logs      : make docker-logs"

.PHONY: docker-down
docker-down:	## stop the stack (volumes preserved)
	docker compose down

.PHONY: docker-logs
docker-logs:	## tail logs from both services
	docker compose logs -f --tail=100

.PHONY: docker-rebuild
docker-rebuild:	## force a clean rebuild of the images
	docker compose build --no-cache

.PHONY: docker-shell
docker-shell:	## open a shell in the backend container
	docker compose exec backend bash

.PHONY: docker-test
docker-test:	## run the backend pytest suite inside the container
	docker compose exec backend python -m pytest tests/ -q

# ── docker (prod compose) ─────────────────────────────────────────────
.PHONY: docker-prod-up
docker-prod-up:	## bring up the prod-shaped stack (frontend on :80, no source mounts)
	docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d

.PHONY: docker-prod-down
docker-prod-down:	## stop the prod-shaped stack
	docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# ── docker (full stack: frontend + backend + orchestrator + redis + postgres) ──
.PHONY: docker-full-up
docker-full-up:	## bring up full stack incl. orchestrator + redis + postgres
	docker compose -f docker-compose.yml -f docker-compose.full.yml up --build -d
	@echo
	@echo "  frontend      → http://localhost:5173"
	@echo "  backend       → http://localhost:8000   (docs at /docs)"
	@echo "  orchestrator  → http://localhost:3000   (health at /health)"
	@echo "  logs          : make docker-full-logs"

.PHONY: docker-full-down
docker-full-down:	## stop full stack (volumes preserved)
	docker compose -f docker-compose.yml -f docker-compose.full.yml down

.PHONY: docker-full-logs
docker-full-logs:	## tail logs from full stack services
	docker compose -f docker-compose.yml -f docker-compose.full.yml logs -f --tail=120

# ── safe nukes ────────────────────────────────────────────────────────
.PHONY: docker-clean
docker-clean:	## drop containers + named volumes (state under agents/ is LOST)
	@echo "WARNING: this deletes the openqwnt-agents volume (dynamic tools, journals, telemetry)."
	@read -p "type 'yes' to continue: " confirm && [ "$$confirm" = "yes" ]
	docker compose down -v
