<style>
  body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; line-height: 1.6; }
  h1 { color: #1E3A8A; font-size: 2.2em; border-bottom: 2px solid #1E3A8A; padding-bottom: 10px; }
  h2 { color: #2563EB; font-size: 1.5em; margin-top: 30px; }
  p, li { font-size: 1.1em; }
  .highlight { background: #EEF2FF; padding: 15px; border-radius: 8px; border-left: 4px solid #2563EB; }
</style>

# OpenQwnt (Fyer)

**Vision:** A unified, agentic quant platform where strategies are designed visually, backtested canonically, and executed safely (paper/live) — all optimized by a self-improving loop that keeps what wins.

## Problem
In the algorithmic trading ecosystem, quant research and execution are historically fragmented. Researchers jump between Python notebooks, scattered backtest scripts, and convoluted broker APIs. Furthermore, most systems lack robust, built-in risk guardrails for safe paper-to-live execution, and AI is bolted on as an afterthought rather than a fully integrated, autonomous agent capable of dynamically generating tools and self-improving strategies.

## Potential
There is a massive gap between institutional-grade infrastructure and retail/prop-team accessibility. OpenQwnt bridges this by providing:
- **Visual Strategy Builder:** Node-based workflow (React/Vite).
- **Agentic Capabilities:** Google ADK & LLM-driven orchestration that can write its own dynamic tools.
- **Enterprise-Grade Stack:** Bloomberg-style terminal screens, canonical backtest engine (`backtesting.py`), and robust risk gating.
- **Target Market:** Prop trading firms, solo quants, and academic researchers seeking faster iteration from idea to live deployment.

## Traction & Milestones
- **Architecture Complete:** Progressed through 10 major architectural phases (Phases A–J).
- **Core Systems Live:** Fully operational canonical backtest engine, dynamic agent sandbox, and live/paper execution paths (Alpaca, IBKR, IG).
- **Advanced Features Deployed:** Shipped an autonomous **self-improvement loop** (mutates strategy params dynamically) and complete real-time market data pipelines.
- **Tech Stack:** Hardened multi-service environment (FastAPI, React/Vite, Node.js Orchestrator) fully containerized via Docker.

## Team
<div class="highlight">
<strong>Sina Rajaeeian</strong> — Founder & Sole Developer<br>
Pursuing a Double M.Sc. at KTH Royal Institute of Technology (Industrial Engineering & Management + Machine Learning). A passionate builder at the intersection of AI/ML, full-stack development, and quantitative finance. Hackathon powerhouse (top finishes at Nordea×AWS, G-Research Quant, QuantumBlack×Lovable) and experienced software consultant.
</div>
