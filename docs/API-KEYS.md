# API Keys & Third-Party Services

Everything that the app reads from `process.env` / `os.getenv`, grouped by
what the feature does, with the signup URL and whether it's free.

> **TL;DR** — the app will boot with only **Supabase + Gemini + DeepSeek**
> configured. Every other key in this document is optional and unlocks a
> specific feature (extra market-data coverage, brokers, notifications,
> research connectors, …). Anything without a key falls back to yfinance
> / SEC EDGAR / public RSS / deterministic mocks.

Copy `.env.example` → `.env` and also `backend/.env.example` → `backend/.env`,
then paste keys into both places.

---

## 1. Required to boot

| Env var | Purpose | Free? | Where to get it |
|---|---|---|---|
| `VITE_SUPABASE_PROJECT_ID` / `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_URL` | Auth, user profiles, saved strategies | Yes (generous free tier) | [supabase.com](https://supabase.com/dashboard) → new project → Settings → API |
| `GEMINI_API_KEY` | AI strategy generation, ADK agents, AI assistant, web-grounded search | Yes (generous free tier) | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) |
| `DEEPSEEK_API_KEY` | Strategy validator, secondary LLM | Paid but very cheap (~$0.14/1M tokens) | [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys) |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` / `ENCRYPTION_KEY` | Sign sessions and encrypt stored broker creds | n/a | Generate with `openssl rand -hex 32` (in production — the dev defaults are unsafe) |

---

## 2. Market data (optional; yfinance is the fallback)

Every terminal function (HDS, DES, GIP, SPLC, WEI/BMAP) now hits the backend
`/api/terminal/*` routes which use **yfinance** by default — no key needed.
Add the keys below for better coverage, higher rate limits, or data yfinance
can't provide (supply chain, 13F delta-over-time, earnings call transcripts).

| Env var | Purpose | Free tier | Signup |
|---|---|---|---|
| `FMP_API_KEY` | Fundamentals, 13F (Ultimate tier), supply-chain peers, economic calendar, stock screener | 250 calls/day | [financialmodelingprep.com](https://site.financialmodelingprep.com/developer/docs) |
| `ALPHA_VANTAGE_API_KEY` | Intraday prices, FX, crypto, fundamentals | 5 calls/min, 500 calls/day | [alphavantage.co/support/#api-key](https://www.alphavantage.co/support/#api-key) |
| `FINNHUB_API_KEY` | Real-time quotes, SEC filings, earnings, social sentiment | 60 calls/min | [finnhub.io/dashboard](https://finnhub.io/dashboard) |
| `POLYGON_API_KEY` | Institutional-grade US equities + options | 5 calls/min free | [polygon.io](https://polygon.io/dashboard/api-keys) |
| `FRED_API_KEY` | Macro data (CPI, GDP, rates, VIX, etc.) | Fully free | [fredaccount.stlouisfed.org/apikeys](https://fredaccount.stlouisfed.org/apikeys) |
| `NEWSAPI_KEY` | Consumer-grade news headlines | 100 requests/day | [newsapi.org/register](https://newsapi.org/register) |

SEC EDGAR (filings, 13F, company facts) is used without a key — the backend
just identifies itself via the `SEC_USER_AGENT` env var. Replace the default
string in `backend/.env` with your own contact info.

---

## 3. Broker APIs (live trading)

All brokers are optional. Configure only the ones you actually trade with.

| Env vars | Broker | Notes |
|---|---|---|
| `IG_API_KEY` / `IG_USERNAME` / `IG_PASSWORD` / `IG_ACCOUNT_TYPE` | IG Markets (CFDs, FX, spread betting) | Free DEMO mode: [labs.ig.com/gettingstarted](https://labs.ig.com/gettingstarted) |
| `ALPACA_API_KEY` / `ALPACA_API_SECRET` / `ALPACA_BASE_URL` | Alpaca (US stocks + crypto) | Free paper trading. Get keys at [app.alpaca.markets](https://app.alpaca.markets/paper/dashboard/overview) |
| `BINANCE_API_KEY` / `BINANCE_API_SECRET` | Binance (crypto spot + futures) | [binance.com/en/my/settings/api-management](https://www.binance.com/en/my/settings/api-management) — enable Spot trading permission |
| `NORDNET_API_KEY` / `NORDNET_PRIVATE_KEY` | Nordnet (Nordic retail) | Needs Ed25519 keypair — generate locally, upload pubkey at "Min Säkerhet". Docs: [nordnet.se/.../api](https://www.nordnet.se/se/kundservice/api) |
| `IBKR_GATEWAY_URL` / `IBKR_ACCOUNT_ID` | Interactive Brokers (Client Portal API) | Requires running IBKR's Client Portal gateway locally |

---

## 4. Notifications

| Env var | Channel | Signup |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_DEFAULT_CHAT_ID` | Telegram alerts | Create bot via `@BotFather`, then send any message to your bot and read your chat_id from `https://api.telegram.org/bot<TOKEN>/getUpdates` |
| `SLACK_BOT_TOKEN` + `SLACK_DEFAULT_CHANNEL` | Slack | [api.slack.com/apps](https://api.slack.com/apps) → Create → OAuth & Permissions → `chat:write` scope |
| `DISCORD_BOT_WEBHOOK_URL` | Discord | Server → Channel → Integrations → Webhooks → New Webhook |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER` | SMS | [console.twilio.com](https://console.twilio.com) — free trial credits |
| `SENDGRID_API_KEY` / `EMAIL_FROM_ADDRESS` | Email | [app.sendgrid.com/settings/api_keys](https://app.sendgrid.com/settings/api_keys) — 100 emails/day free |

---

## 5. Research / scraping connectors

Enable these to give the agents more powerful tools. None are required.

| Env var | Purpose | Signup |
|---|---|---|
| `FIRECRAWL_API_KEY` | Turns any URL into LLM-ready markdown (used by the `scrape_url_text` agent tool) | [firecrawl.dev](https://www.firecrawl.dev/app/api-keys) — free tier ≈ 500 pages/mo |
| `PERPLEXITY_API_KEY` | AI-assisted web research | [perplexity.ai/settings/api](https://www.perplexity.ai/settings/api) |
| `TAVILY_API_KEY` | Clean web-search API, preferred over raw Google CSE | [app.tavily.com](https://app.tavily.com/) — 1,000 searches/mo free |
| `BRAVE_SEARCH_API_KEY` | Privacy-friendly search | [api.search.brave.com/app/keys](https://api.search.brave.com/app/keys) — 2,000 queries/mo free |
| `GOOGLE_CSE_API_KEY` + `GOOGLE_CSE_ID` | Google Programmable Search fallback | [programmablesearchengine.google.com](https://programmablesearchengine.google.com/) + enable Custom Search API in [console.cloud.google.com](https://console.cloud.google.com/) |
| `TRADINGVIEW_WEBHOOK_SECRET` | Authenticates inbound TradingView alerts (no signup — you pick the string) | Paste the same secret into TradingView's alert body |

---

## 6. What the user has to do manually

Because I can't sign up for third-party accounts on your behalf, **these are
the keys I couldn't fetch automatically** — create each account, generate a
key, and paste it into `.env` + `backend/.env`.

**Priority order (what unlocks the most user-visible features first):**

1. ✅ **Gemini** — unlocks AI strategy generation, all agents, research chat, web-grounded search used by broker discovery.
2. ✅ **DeepSeek** — unlocks strategy validation and cheap secondary-LLM calls.
3. ✅ **Supabase** — unlocks auth, saved strategies, user profiles.
4. 🆕 **FRED** — unlocks real macro data in the Macro fetcher (currently silent without it).
5. 🆕 **FMP** — dramatically improves DES / HDS / SPLC terminal screens and unlocks real supply-chain peers.
6. 🆕 **Finnhub** — unlocks real-time quotes + sentiment in news fetcher.
7. 🔁 **A broker of your choice** — Alpaca paper trading is fastest to set up (free, no KYC).
8. 🔁 **Telegram bot** — fastest working notification channel (takes ~2 minutes with `@BotFather`).
9. 🟡 **Firecrawl** — gives the research agent a real scraper instead of failing silently.
10. 🟡 **Tavily** — gives the research agent a search API.

Ticks: ✅ already in your `.env`, 🆕 new key you should add, 🔁 pick at least one, 🟡 optional QoL.

---

## 7. What works without any new keys

Even with only the three required keys configured, the following is fully
functional today:

- AI strategy generation + validation (Gemini + DeepSeek).
- Visual strategy builder (ReactFlow canvas).
- **Terminal / DES, GIP, HDS, SPLC, BMAP** — all now hit the backend
  `/api/terminal/*` router which pulls live data from yfinance + SEC EDGAR.
- SEC filings fetcher (EDGAR is free).
- Reddit / RSS news fetchers (public endpoints).
- Backtesting engines (backtrader / backtesting.py / NautilusTrader).
- IG Markets DEMO trading (the `.env` already ships with working demo creds).

Everything else degrades gracefully to deterministic mock data so the UI
never breaks.
