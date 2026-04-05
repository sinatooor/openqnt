# =============================================================================
# OpenQwnt Trading Platform - Backend Dockerfile
# Multi-stage build with conda for complex dependencies (NautilusTrader)
# =============================================================================

# Stage 1: Base image with conda
FROM continuumio/miniconda3:latest AS base

# Set working directory
WORKDIR /app

# Install system dependencies (including TA-Lib C library)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    libffi-dev \
    libssl-dev \
    curl \
    git \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install TA-Lib C library from source
RUN wget -q https://github.com/TA-Lib/ta-lib/releases/download/v0.6.4/ta-lib-0.6.4-src.tar.gz \
    && tar -xzf ta-lib-0.6.4-src.tar.gz \
    && cd ta-lib-0.6.4 \
    && ./configure --prefix=/usr \
    && make -j$(nproc) \
    && make install \
    && cd .. \
    && rm -rf ta-lib-0.6.4 ta-lib-0.6.4-src.tar.gz

# Create conda environment with Python 3.12
RUN conda create -n openqwnt python=3.12 -y -c conda-forge

# Make RUN commands use the new environment
SHELL ["conda", "run", "-n", "openqwnt", "/bin/bash", "-c"]

# Copy requirements first for better caching
COPY requirements.txt .

# Install CPU-only torch first to avoid downloading ~5GB of CUDA libraries.
# NautilusTrader depends on torch, but the trading backend does not need GPU.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Install core framework packages
RUN pip install --no-cache-dir \
    fastapi uvicorn[standard] python-dotenv httpx pydantic python-multipart

# Install data processing and trading packages
RUN pip install --no-cache-dir \
    pandas numpy sqlalchemy aiosqlite aiohttp yfinance pytz \
    feedparser quantstats statsmodels redis

# Install backtesting engines and broker clients
RUN pip install --no-cache-dir \
    nautilus_trader backtesting backtrader trading-ig python-binance TA-Lib

# Install RAG and vector DB
RUN pip install --no-cache-dir \
    chromadb sentence-transformers

# Install AI/LLM packages
RUN pip install --no-cache-dir \
    google-adk google-generativeai openai anthropic

# =============================================================================
# Stage 2: Production image
# =============================================================================
FROM continuumio/miniconda3:latest AS production

WORKDIR /app

# Install curl for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Copy conda environment from builder
COPY --from=base /opt/conda/envs/openqwnt /opt/conda/envs/openqwnt

# Copy TA-Lib shared libraries
COPY --from=base /usr/lib/libta_lib* /usr/lib/
COPY --from=base /usr/include/ta-lib /usr/include/ta-lib

# Set environment variables
ENV PATH=/opt/conda/envs/openqwnt/bin:$PATH
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Copy application code
COPY . .

# Create directories for data persistence
RUN mkdir -p /app/chroma_db_v2 /app/data /app/logs

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

# =============================================================================
# Stage 3: Development image (optional)
# =============================================================================
FROM production AS development

# Install development dependencies
RUN pip install --no-cache-dir \
    pytest pytest-asyncio black isort mypy

# Enable hot reloading
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
