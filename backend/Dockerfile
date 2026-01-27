# =============================================================================
# Fyer Trading Platform - Backend Dockerfile
# Multi-stage build with conda for complex dependencies (NautilusTrader)
# =============================================================================

# Stage 1: Base image with conda
FROM continuumio/miniconda3:latest AS base

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    libffi-dev \
    libssl-dev \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Create conda environment with Python 3.12
RUN conda create -n fyer python=3.12 -y -c conda-forge

# Make RUN commands use the new environment
SHELL ["conda", "run", "-n", "fyer", "/bin/bash", "-c"]

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
# Split heavy packages for better caching
RUN pip install --no-cache-dir \
    fastapi==0.115.6 \
    uvicorn==0.34.0 \
    python-dotenv==1.0.1 \
    httpx==0.28.1 \
    pydantic==2.10.3

RUN pip install --no-cache-dir \
    pandas>=2.0.0 \
    numpy>=1.26.0 \
    sqlalchemy>=2.0.0 \
    aiohttp>=3.9.0

RUN pip install --no-cache-dir \
    yfinance>=0.2.0 \
    pytz>=2023.3

# Install NautilusTrader (heavy package)
RUN pip install --no-cache-dir nautilus_trader>=1.200.0

# Install RAG dependencies
RUN pip install --no-cache-dir \
    chromadb>=0.4.0 \
    sentence-transformers>=2.2.2

# Install trading broker clients
RUN pip install --no-cache-dir trading-ig>=0.0.22

# Install Google ADK for AI agents
RUN pip install --no-cache-dir google-adk

# Install additional AI/LLM dependencies
RUN pip install --no-cache-dir \
    openai \
    anthropic \
    google-generativeai

# =============================================================================
# Stage 2: Production image
# =============================================================================
FROM continuumio/miniconda3:latest AS production

WORKDIR /app

# Copy conda environment from builder
COPY --from=base /opt/conda/envs/fyer /opt/conda/envs/fyer

# Set environment variables
ENV PATH=/opt/conda/envs/fyer/bin:$PATH
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
    pytest>=7.0.0 \
    pytest-asyncio \
    black \
    isort \
    mypy

# Enable hot reloading
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
