# Fyer Trading Platform - Docker Setup Guide

## Quick Start

### Prerequisites
- Docker Desktop installed
- Docker Compose v2+

### Development Mode

```bash
# Start backend only (recommended for development)
docker-compose up backend redis

# Or start everything including frontend
docker-compose --profile frontend up
```

### Production Mode

```bash
# Build production images
docker-compose build

# Start with nginx reverse proxy
docker-compose --profile production up -d
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| backend | 8000 | FastAPI + AI Agents |
| frontend | 5173 | React + Vite (dev) |
| redis | 6379 | Caching |
| nginx | 80/443 | Reverse proxy (prod) |

## Environment Variables

Create a `.env` file in the project root:

```env
# LLM API Keys
DEEPSEEK_API_KEY=your_key_here
GEMINI_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here      # Optional
ANTHROPIC_API_KEY=your_key_here   # Optional

# Broker API (Optional)
IG_API_KEY=your_key_here
IG_USERNAME=your_username
IG_PASSWORD=your_password
IG_ACCOUNT_TYPE=DEMO
```

## Common Commands

```bash
# View logs
docker-compose logs -f backend

# Rebuild after code changes
docker-compose build backend

# Stop all services
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v

# Execute command in container
docker-compose exec backend bash

# Run tests
docker-compose exec backend pytest
```

## Volumes

Data is persisted in Docker volumes:
- `fyer-chroma-data` - Vector database
- `fyer-db-data` - SQLite database
- `fyer-redis-data` - Redis cache
- `fyer-logs` - Application logs

## Development Workflow

1. **Backend hot-reloading**: Source code is mounted, changes auto-reload
2. **Frontend hot-reloading**: Use `--profile frontend` flag

### Without Docker (Local Development)

```bash
# Activate conda environment
conda activate fyer

# Start backend
cd backend
uvicorn main:app --reload --port 8000

# Start frontend (separate terminal)
npm run dev
```

## Troubleshooting

### Container won't start
```bash
docker-compose logs backend
```

### Reset everything
```bash
docker-compose down -v
docker system prune -f
docker-compose up --build
```

### Check health
```bash
curl http://localhost:8000/health
```
