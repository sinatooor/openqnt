# Data Providers & Monthly Cost Plan

**Last updated:** 2026-04-26
**Scope:** Every external data source the app touches — terminal modules,
agents, vessel/news/weather feeds, AI/LLM, hosting — with concrete monthly
cost at three operating tiers.

> Goal: be a Bloomberg-lite quant terminal with AI agents that can pull
> real market, vessel, news, weather, and macro data as tools. The numbers
> below are real signup-page prices as of April 2026; vendors raise prices,
> so re-verify before paying annually.

---

## 1. Terminal modules → recommended data source

| Module | Code | What it needs | Best provider | Why |
|---|---|---|---|---|
| Intraday Graph | GIP | OHLCV bars, real VWAP, pre/post hours | **Polygon.io** | Real VWAP (yfinance fakes it), unlimited intraday history, reliable |
| Company Description | DES | Profile, segments, executives, fundamentals, valuation | **FMP** (Financial Modeling Prep) | Cleanest single-call profile + ratios |
| Holders Detail | HDS | 13F institutions, mutual funds, insiders, **delta vs prior quarter** | **FMP Premium / Ultimate** | yfinance has snapshot only — no delta. FMP has full 13F history |
| Supply Chain | SPLC | Suppliers, customers, peers | **FMP Ultimate** + **Sayari** (optional) | FMP has peers + basic supply chain. Real supply-chain (Sayari/FactSet) is enterprise |
| Relationship Map | RMAP | Owners, peers, supply chain, competitors | Composed from FMP + Finnhub | Aggregator over the others |
| World Equity Indices | WEI/BMAP | Country indices snapshots | **Polygon** or yfinance | Either works |
| Commodity / Vessel Map | BMAP | Oil/gas prices, pipelines, **live vessels (AIS)**, storms | **AISStream.io** + **NOAA** + **EIA** | See vessel section below |

---

## 2. Vessel / Ship Tracking (AIS) — for BMAP

The commodity map needs live vessel positions. There are three realistic
options, very different price points:

| Provider | Pricing | Latency | Coverage | Notes |
|---|---|---|---|---|
| **AISStream.io** | **FREE** (WebSocket) | ~30s | Global terrestrial AIS | Best free option. Unlimited consumption, attribution required. Use for development and even small production. |
| **Datalastic AIS** | $99/mo (Starter) – $499/mo (Pro) | Real-time | Global terrestrial + some satellite | Good middle tier. REST + WebSocket. |
| **MarineTraffic API** | $50/mo (single vessel) – $300+/mo (fleet) – $1500+/mo (full coverage) | Real-time | Best terrestrial coverage worldwide | Most data; expensive at scale. |
| **VesselFinder API** | $200+/mo | Real-time | Similar to MarineTraffic | |
| **Spire Maritime (satellite AIS)** | Enterprise (typically $5k+/mo) | Real-time | **Open ocean** (only satellite has this) | Only do this if you actually need ships in the middle of the Atlantic. Terrestrial AIS misses them. |

**Recommendation:** Start on **AISStream.io free**. Upgrade to Datalastic
($99/mo) only when you need historical voyages or guaranteed SLA.

---

## 3. News & Sentiment

| Provider | Pricing | What you get |
|---|---|---|
| **Polygon News** | Included in Polygon Stocks plan | Headlines tagged to tickers, decent latency |
| **Benzinga Newsfeed API** | $99/mo (Pro) – $300+ (real-time API) | Fastest tradeable news, the standard for daytrading |
| **NewsAPI.org** | Free 100/day → Business $449/mo | Generic news aggregator |
| **Finnhub News & Sentiment** | $50/mo (Premium) | Includes social/Reddit sentiment |
| **MarketAux** | $25/mo | Cheap stock news API |
| **RavenPack** | Enterprise ($$$$$) | Institutional sentiment, used by hedge funds |

**Recommendation:** Polygon News (free with stocks plan) + **Benzinga $99/mo**
for the actual tradeable real-time feed.

---

## 4. Macro / Economic Data

| Provider | Pricing | Coverage |
|---|---|---|
| **FRED (St Louis Fed)** | **FREE** | US macro: CPI, GDP, rates, VIX, all of it |
| **World Bank API** | **FREE** | Global development indicators |
| **IMF API** | **FREE** | Cross-country fiscal/monetary |
| **EIA (US Energy Info Admin)** | **FREE** | Oil/gas/electricity production, storage, imports |
| **Trading Economics** | $99/mo | Global indicators packaged nicely |

**Recommendation:** Stay free. FRED + EIA covers everything you need.

---

## 5. Weather / Storms (BMAP storms layer)

| Provider | Pricing | What |
|---|---|---|
| **NOAA / NWS** | **FREE** | US weather, hurricane tracks, marine forecasts |
| **OpenWeatherMap** | Free 1k/day → $40/mo (Startup) | Global weather + maps |
| **Tomorrow.io** | Free 500/day → $50/mo (Basic) | Global weather, marine, fire |
| **DTN / StormGeo** | Enterprise | Used by shipping/energy desks |

**Recommendation:** NOAA free for hurricanes/storms in US waters; OpenWeatherMap
$40/mo if you need global coverage.

---

## 6. Crypto

| Provider | Pricing | Notes |
|---|---|---|
| **Polygon Crypto** | Bundled with Stocks plan ($29+) | OHLCV across major pairs |
| **CoinGecko API** | Free 30/min → $129/mo (Analyst) | Tokens, on-chain, NFT data |
| **CoinMarketCap API** | Free → $79/mo (Hobbyist) | Similar to CoinGecko |

**Recommendation:** Polygon (already paying for stocks) covers it. Skip the rest unless you need long-tail tokens.

---

## 7. Brokers (already wired)

| Broker | Cost | Notes |
|---|---|---|
| **IG Markets** | Free API with funded account; spread/commissions on trades | Already integrated |
| **Alpaca** | Free | Paper + live US equities/options |
| **Interactive Brokers (TWS API)** | $10/mo data subscriptions per region | Already integrated |
| **Nordnet** | Free | Already integrated |

No subscription cost above what you'd pay to trade anyway.

---

## 8. AI / LLM (the hidden line item)

You already have Anthropic, Gemini, DeepSeek, and an AI Gateway key. These
are pay-per-token, not a flat subscription. Cost depends entirely on
**model**, **call frequency**, and whether you use **prompt caching**.

### 8a. Anthropic per-token pricing (April 2026)

| Model | Input | Output | Cached input read |
|---|---|---|---|
| **Claude Opus 4.7** | $15.00 / M tok | $75.00 / M tok | $1.50 / M tok |
| **Claude Sonnet 4.6** | $3.00 / M tok | $15.00 / M tok | $0.30 / M tok |
| **Claude Haiku 4.5** | $1.00 / M tok | $5.00 / M tok | $0.10 / M tok |

> Cached reads are **10× cheaper than fresh input**. For agents that wake up
> every 5 minutes with the *same* system prompt and tool definitions, prompt
> caching is mandatory — without it costs are roughly 10× higher.

### 8b. Per-call cost (one agent invocation)

Assumed payload for a "typical" agent run:

- **Input:** 10,000 tokens (system prompt + tool definitions + recent context + tool results)
- **Output:** 1,000 tokens

| Model | Cost per call (no cache) | Cost per call (90% cached input) |
|---|---|---|
| Opus 4.7 | **$0.225** | $0.090 |
| Sonnet 4.6 | **$0.045** | $0.018 |
| Haiku 4.5 | **$0.015** | $0.006 |

For a "light polling" agent (just "anything new?" — 10K input cached, 200 output):

| Model | Cost per call |
|---|---|
| Opus 4.7 | $0.030 |
| Sonnet 4.6 | $0.006 |
| Haiku 4.5 | $0.002 |

### 8c. 24/7 every-5-minutes scenario — single agent

That cadence = **12 calls/hour × 24 × 30 = 8,640 calls/month per agent**.

| Model | No cache | With caching | Light polling (cached) |
|---|---|---|---|
| **Opus 4.7** | **$1,944/mo** | **$778/mo** | $259/mo |
| **Sonnet 4.6** | **$389/mo** | **$156/mo** | $52/mo |
| **Haiku 4.5** | **$130/mo** | **$52/mo** | $17/mo |

### 8d. Multi-agent fleet — 5 agents, all 24/7 every 5 min

Realistic agent fleet for this app: market scanner, news monitor, strategy
generator, risk/positions monitor, execution agent.

| Setup | Monthly cost |
|---|---|
| **5× Opus, no cache** | **$9,720** ← don't do this |
| **5× Opus, cached** | **$3,890** |
| **5× Sonnet, cached** | **$780** |
| **5× Haiku, cached** | **$260** |
| **Mixed: 1 Opus (strategist) + 4 Sonnet, cached** | **$778 + $624 = $1,402** |
| **Mixed: 1 Opus + 2 Sonnet + 2 Haiku, all cached + 2 agents are light pollers** | **~$900** ← recommended |

### 8e. What I recommend

1. **Always enable prompt caching** for any 24/7 agent — the 5-min cadence
   pays for itself instantly because the cache TTL is 5 minutes.
2. **Don't run Opus 24/7.** Use Opus *on demand* for strategy generation
   and deep analysis. Use Sonnet for the always-on agents.
3. **Make most polling agents Haiku.** A "did anything change?" check
   doesn't need Opus-level reasoning.
4. **Stretch the cadence when you can.** Going from 5-min to 15-min cuts
   cost by 3×. Most "real-time" doesn't need 5-minute granularity.

### 8f. Realistic AI/LLM budget for this app

| Profile | Monthly LLM cost |
|---|---|
| **Solo dev, manual agent runs only** | **$30–$80** |
| **5 always-on agents @ 5 min, mixed Sonnet/Haiku, cached** | **$300–$500** |
| **5 always-on agents @ 5 min, mostly Sonnet/Opus, cached** | **$1,000–$2,000** |
| **5 Opus agents @ 5 min, no cache** | **~$10,000** ← architecture mistake |

---

## 9. Infrastructure / Hosting

| Item | Cost |
|---|---|
| **Supabase Pro** | $25/mo |
| **Vercel** (frontend) | $0 Hobby → $20/mo Pro |
| **Backend hosting** (Render / Railway / Fly.io) | $20–$50/mo for a real instance |
| **Domain** | ~$1.50/mo amortised |
| **Twilio** (SMS alerts) | ~$10–$30/mo at light volume |
| **Sentry / observability** | $0 free → $26/mo Team |

**Total infra: ~$80/mo** at solo-dev scale.

---

## 10. Three budget tiers — total monthly cost

### TIER 1 — Lean Indie ($100–$150/mo)
Everything works with real data, but you're rate-limited and miss some features.

| Item | Cost |
|---|---|
| Polygon Stocks **Starter** | $29 |
| FMP **Starter** | $22 |
| AISStream.io vessels | $0 |
| NOAA + FRED + EIA + SEC EDGAR | $0 |
| Polygon News (bundled) | $0 |
| Supabase Pro | $25 |
| Vercel Pro | $20 |
| Backend hosting (Render starter) | $20 |
| AI/LLM (light) | $50 |
| **TOTAL** | **~$166/mo** |

### TIER 2 — Premium Solo Trader, manual AI use ($600–$800/mo)
Real-time data everywhere, but agents are run manually / on-demand.

| Item | Cost |
|---|---|
| Polygon Stocks **Advanced** (real-time NBBO) | $199 |
| FMP **Ultimate** (full 13F, supply chain) | $69 |
| Datalastic AIS (real-time vessels + history) | $99 |
| Benzinga Newsfeed Pro | $99 |
| Finnhub Premium (sentiment) | $50 |
| OpenWeatherMap Startup | $40 |
| NOAA + FRED + EIA + AISStream backup | $0 |
| Supabase Pro | $25 |
| Vercel Pro | $20 |
| Backend hosting (Render standard) | $25 |
| Twilio + Sentry | $40 |
| AI/LLM (manual agent runs only) | $80 |
| **TOTAL** | **~$746/mo** |

### TIER 2+ — Always-on Agents (~$1,500–$1,800/mo) ← **realistic for your goal**
Same data feeds as Tier 2, but with 5 agents running 24/7 every 5 minutes
(scanner / news / strategist / risk / execution). Mixed model fleet with
prompt caching enabled.

| Item | Cost |
|---|---|
| All Tier 2 data feeds + infra (above, minus AI line) | $666 |
| **AI/LLM:** 1 Opus (on-demand strategist) + 2 Sonnet (5-min cadence) + 2 Haiku (light pollers, 5-min cadence), all cached | **~$900** |
| **TOTAL** | **~$1,566/mo** |

> Switching the 2 Sonnet agents to a 15-min cadence drops the LLM line to
> ~$500/mo and the total to ~$1,166/mo without losing much in practice.

> Going all-Opus 24/7 with no caching would push the LLM line to ~$10k/mo —
> that's an architecture mistake, not a price tier. See §8 for why.

### TIER 3 — Institutional ($5,000–$50,000+/mo)
Only if you actually need the institutional feeds. Most solo quants don't.

| Item | Approx cost |
|---|---|
| Polygon Business / Bloomberg-lite tier | $1,000+ |
| Sayari / FactSet supply chain | $5,000+ |
| Spire Maritime satellite AIS | $5,000+ |
| RavenPack sentiment | $10,000+ |
| Refinitiv / Bloomberg Terminal | $24,000/yr/seat |
| **TOTAL** | **$5k–$50k+/mo** |

You don't need this tier. Skip it.

---

## 11. Recommended path

1. **Today (free):** Wire Polygon free tier + FMP free tier + AISStream.io free.
   You can build and test every module without paying anything.
2. **First $51/mo:** Polygon Starter + FMP Starter — turns the terminal real.
3. **Premium Solo Trader (~$870/mo):** When you have real users or are
   running strategies live, upgrade to Tier 2.
4. **Don't go to Tier 3** unless you become a hedge fund.

---

## 12. What this app does NOT need (yet)

- Bloomberg Terminal subscription ($24k/yr per seat)
- Refinitiv Eikon (similar)
- Sayari / FactSet supply chain (enterprise)
- Spire / orbital satellite AIS (enterprise; AISStream covers terrestrial)
- RavenPack sentiment (enterprise)

If anyone tries to sell you these, say no until you have institutional clients.
