# Contributing to OpenQnt

Thanks for wanting to help. Bug reports, fixes, new strategy templates and
docs improvements are all welcome.

Before you start, note that OpenQnt is **source-available** under the
[OpenQnt Community License](LICENSE), not an OSI open-source license. By
opening a pull request you agree to the contribution terms in the LICENSE.

## Getting set up

You need Node.js 20+, Python 3.12 and (optionally) Docker.

```bash
git clone https://github.com/sinatooor/openqnt.git
cd openqnt
cp .env.example .env            # every key is optional

# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --port 8000

# Frontend (second terminal, repo root)
npm install
npm run dev                     # http://localhost:5173
```

Prefer Docker? `make docker-up` starts the backend and frontend together.
See the [README](README.md#quick-start) for the other options.

## Before you open a pull request

Run the same checks CI runs:

```bash
npm run lint
npx tsc --noEmit -p tsconfig.app.json
npm test -- --run
cd backend && pytest tests/ -q
```

- Keep pull requests focused on one change.
- Add or update tests when you change behaviour, especially anything in
  `backend/backtest/` or `backend/execution/`.
- Never commit API keys, broker credentials or `.env` files.
- Write commit messages in the imperative mood ("Add RSI template", not
  "Added RSI template").

## Reporting bugs and asking for features

Use the issue templates. For a bug, include the steps to reproduce it, what
you expected and what happened, and your OS, Node and Python versions.

Security problems should **not** go in a public issue. See
[SECURITY.md](SECURITY.md).

## Code of conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Be kind.
