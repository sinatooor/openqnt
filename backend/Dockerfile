# syntax=docker/dockerfile:1.7
# =============================================================================
# Backend image — FastAPI app powering Phases B-J.
#
# Replaces the old miniconda3 + NautilusTrader + torch + TA-Lib build (~5 GB)
# with a slim python:3.12 image carrying only what the Phase B-J modules
# actually import. Final size: ~600 MB (most of which is pandas + numpy
# + matplotlib + backtesting.py wheels).
#
# Two stages:
#   - builder : compile wheels into a venv at /opt/venv
#   - runtime : python:3.12-slim, copy /opt/venv across
#
# Targets: `dev` (uvicorn --reload, source mounted via compose) and
# `prod` (uvicorn no reload, source COPYed).
# =============================================================================

ARG PYTHON_VERSION=3.12

# ── builder ─────────────────────────────────────────────────────────────
FROM python:${PYTHON_VERSION}-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Build deps for any wheels that don't ship pre-built (e.g. backtesting.py
# pulls bokeh which is pure-python; pyarrow ships wheels). curl for
# diagnostics, build-essential just in case.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Self-contained venv so the runtime image just needs to copy /opt/venv.
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Phase B-J explicit dependency list. Keep this short on purpose — every
# extra package is build time + image size + supply-chain surface.
RUN pip install --upgrade pip wheel setuptools

RUN pip install \
    # core API
    fastapi==0.115.* \
    "uvicorn[standard]==0.32.*" \
    pydantic==2.* \
    httpx==0.27.* \
    python-dotenv==1.* \
    python-multipart==0.0.* \
    websockets==12.* \
    # data + charts
    pandas==2.* \
    numpy==1.* \
    matplotlib==3.9.* \
    pyarrow==17.* \
    # backtest engine (Phase D)
    backtesting==0.3.* \
    yfinance==0.2.* \
    # broker integrations (Phase H)
    ibapi==9.81.1.post1 \
    # LLM (optional — boss + improvement-mutator fall back without a key)
    google-genai==0.3.*

# ── runtime ────────────────────────────────────────────────────────────
FROM python:${PYTHON_VERSION}-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/opt/venv/bin:$PATH" \
    # matplotlib font cache lives under /app/agents/_cache/mpl after first
    # request; make sure the dir exists with the right permissions.
    MPLBACKEND=Agg

# Runtime deps only: curl for healthcheck.
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system --gid 1001 app \
    && useradd --system --uid 1001 --gid app --create-home app

WORKDIR /app
COPY --from=builder /opt/venv /opt/venv

# `agents/` will be mounted as a volume in compose; pre-create it so the
# image owns the path even if the volume is empty on first boot.
RUN mkdir -p /app/agents && chown -R app:app /app /opt/venv
USER app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8000/health || exit 1

# ── dev target ─────────────────────────────────────────────────────────
# Source is mounted from the host via compose so we don't COPY here.
FROM runtime AS dev
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ── prod target ────────────────────────────────────────────────────────
FROM runtime AS prod
COPY --chown=app:app . /app
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
