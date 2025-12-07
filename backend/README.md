# Local Python Backend (DeepSeek)

Local backend for strategy generation using DeepSeek API.

## Setup

```bash
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your DeepSeek API key
```

## Run

```bash
uvicorn main:app --reload --port 8000
```

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Health check |
| `/generate-strategy` | POST | Generate Blockly XML |
| `/generate-mql` | POST | Generate MQL5 code |

## Example

```bash
curl -X POST http://localhost:8000/generate-strategy \
  -H "Content-Type: application/json" \
  -d '{"message": "Create an SMA crossover strategy"}'
```

## Get DeepSeek API Key

1. Go to https://platform.deepseek.com/
2. Sign up / Log in
3. Go to API Keys section
4. Create new API key
5. Add to `backend/.env`
