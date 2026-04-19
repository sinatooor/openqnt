/**
 * simulatedRun — drives a believable, Cursor-style agent stream until a real
 * backend is wired up.
 *
 * The goal is that the /agents page feels alive right now: when you click
 * "Run" on any agent, you see thoughts typing in, tool calls being dispatched
 * with pending → success transitions, plots appearing, and a final
 * conclusion + memory.md append. The script is shaped by the agent's known
 * capabilities (e.g. a Quant Agent prefers terminal functions, a Technical
 * Analyst prefers indicators).
 *
 * The moment a real SSE / websocket bridge exists, swap this function with a
 * thin adapter that pipes backend events into the same store actions.
 */

import { useAgentMonitorStore } from '../store/agentMonitorStore';
import type { AgentInstance, StreamEvent } from '../types';

// ────────────────────────────────────────────── Small utilities ────────

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

const jitter = (min: number, max: number) =>
  min + Math.floor(Math.random() * (max - min));

async function streamText(
  eventId: string,
  fullText: string,
  opts: { charsPerTick?: number; tickMs?: number } = {}
): Promise<void> {
  const charsPerTick = opts.charsPerTick ?? jitter(3, 8);
  const tickMs = opts.tickMs ?? jitter(20, 60);
  const patch = useAgentMonitorStore.getState().patchEvent;
  let i = 0;
  while (i < fullText.length) {
    i = Math.min(fullText.length, i + charsPerTick);
    patch(eventId, { text: fullText.slice(0, i), partial: i < fullText.length });
    await sleep(tickMs);
  }
  patch(eventId, { text: fullText, partial: false });
}

// ──────────────────────────────────── Per-agent-type capability hints ──

/** Pick a plausible set of steps for the agent, influenced by its type and
 *  its configured meta (e.g. which terminal tools a Quant Agent is allowed
 *  to call).  Each step is rendered as a (thought → tool_call → tool_result)
 *  triplet in the stream. */
function planSteps(agent: AgentInstance, symbol: string): Array<{
  thought: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  toolOutput: string;
  status: 'success' | 'error';
}> {
  const type = agent.agentType;

  if (type === 'quant_analyst' || agent.agentNodeType === 'quantAgentNode') {
    const allowed =
      (agent.meta?.terminalTools as string[] | undefined) ??
      ['HDS', 'DES', 'GIP', 'SPLC', 'WEI'];
    const pick = (code: string, think: string, out: string) =>
      allowed.includes(code)
        ? [{ thought: think, toolName: code, toolInput: { ticker: symbol }, toolOutput: out, status: 'success' as const }]
        : [];
    return [
      ...pick(
        'DES',
        `I should start with a company overview for ${symbol} to anchor my priors.`,
        `# ${symbol} — Description\nMarket cap: $2.9T · Sector: Technology · Beta: 1.12\nKey segments: Services (24%), iPhone (49%), Wearables (11%).`
      ),
      ...pick(
        'HDS',
        `Who owns ${symbol}? Institutional positioning often leads sentiment.`,
        `# ${symbol} — Top Holders\n1. Vanguard 8.9% (+0.2%)\n2. BlackRock 7.1% (-0.1%)\n3. Berkshire 5.8% (unchanged)\nInstitutional ownership rising QoQ — constructive.`
      ),
      ...pick(
        'GIP',
        `Check today's intraday tape — is price confirming the fundamental story?`,
        `# ${symbol} — Intraday\nOpen 189.40 · High 191.20 · Low 188.60 · Last 190.85 (+0.76%)\nVolume tracking 1.3x 20-day avg.`
      ),
      ...pick(
        'SPLC',
        `Any supply-chain risks that haven't priced in yet?`,
        `# ${symbol} — Supply Chain\nTier-1: TSM (20%), FoxConn (12%), LG Display (6%)\nNo red flags this cycle; TSM capacity up 8%.`
      ),
      ...pick(
        'WEI',
        `Finally, take the macro temperature across world indices.`,
        `# World Equity Indices\nUS SPX +0.4% · NDX +0.6% · DAX +0.1% · NIKKEI +1.2%\nRisk-on tone, supports the long case.`
      ),
    ];
  }

  if (type === 'research_analyst' || agent.agentNodeType === 'researchAgentNode') {
    return [
      { thought: 'Load the strategy returns series and run QuantStats tearsheet.', toolName: 'quantstats.tearsheet', toolInput: { symbol }, toolOutput: 'Sharpe 1.42 · Sortino 2.11 · Max DD -14.2% · Win rate 58%.', status: 'success' },
      { thought: 'Stress-test with 1,000 Monte Carlo paths to size tail risk.', toolName: 'montecarlo.simulate', toolInput: { paths: 1000, horizon_days: 252 }, toolOutput: 'VaR(95) -3.2% · CVaR(95) -4.8% · Prob(DD<-20%) = 6%.', status: 'success' },
      { thought: 'Cross-check stability with a walk-forward on rolling 6-month windows.', toolName: 'walk_forward', toolInput: { window: '6M', step: '1M' }, toolOutput: 'Out-of-sample Sharpe 1.11 (in-sample 1.42) — ~22% decay, acceptable.', status: 'success' },
    ];
  }

  if (type === 'news_analyst') {
    return [
      { thought: `Pull latest headlines for ${symbol} and score sentiment.`, toolName: 'news.search', toolInput: { symbol, hours: 24 }, toolOutput: '12 articles · avg sentiment +0.31 · dominant topics: earnings, buyback.', status: 'success' },
      { thought: 'Check for SEC filings that might override the narrative.', toolName: 'sec.latest', toolInput: { symbol }, toolOutput: 'Latest 8-K filed 2d ago — routine dividend declaration, non-material.', status: 'success' },
    ];
  }

  if (type === 'technical_analyst') {
    return [
      { thought: `Compute RSI(14), MACD and 20/50 EMAs for ${symbol}.`, toolName: 'ta.bundle', toolInput: { symbol, indicators: ['rsi', 'macd', 'ema'] }, toolOutput: 'RSI 58 (neutral-bullish) · MACD crossover up · EMA20 > EMA50.', status: 'success' },
      { thought: 'Scan the last 60 bars for candlestick patterns.', toolName: 'ta.patterns', toolInput: { symbol, bars: 60 }, toolOutput: 'Morning star + bullish engulfing within last 5 bars.', status: 'success' },
    ];
  }

  // Generic fallback.
  return [
    { thought: `Gather context on ${symbol} before concluding.`, toolName: 'context.fetch', toolInput: { symbol }, toolOutput: 'Context retrieved (price, recent news, peer comps).', status: 'success' },
    { thought: 'Form a working hypothesis and double-check against base rates.', toolName: 'reason.check', toolInput: { hypothesis: 'asymmetric upside' }, toolOutput: 'Base rates OK; hypothesis consistent with priors.', status: 'success' },
  ];
}

// ──────────────────────────────────────────── Mock artifact (SVG plot) ──

function buildMockPlotDataUrl(symbol: string): string {
  // Cheap SVG line-chart — looks like a Cursor-embedded plot.
  const points: string[] = [];
  const base = 100 + Math.random() * 20;
  let y = base;
  for (let x = 0; x <= 200; x += 4) {
    y += (Math.random() - 0.45) * 4;
    points.push(`${x},${80 - (y - base) * 1.6}`);
  }
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 90" width="440" height="180">
  <defs>
    <linearGradient id="g" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0%" stop-color="#7c3aed" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#7c3aed" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="220" height="90" fill="#0a0a0f"/>
  <polyline fill="none" stroke="#a78bfa" stroke-width="1.2" points="${points.join(' ')}"/>
  <polygon fill="url(#g)" points="0,90 ${points.join(' ')} 220,90"/>
  <text x="8" y="14" font-family="ui-monospace, monospace" font-size="9" fill="#e2e8f0">${symbol} · synthesised tape</text>
</svg>`;
  const b64 = typeof window !== 'undefined' && window.btoa
    ? window.btoa(unescape(encodeURIComponent(svg)))
    : Buffer.from(svg, 'utf-8').toString('base64');
  return `data:image/svg+xml;base64,${b64}`;
}

// ──────────────────────────────────────────── Main entry point ─────────

export interface SimulateRunOptions {
  agentId: string;
  task?: string;
  symbols?: string[];
}

/** Kick off a fake run. Returns the runId immediately; events keep arriving
 *  in the background. Safe to call multiple times — each call spawns its own
 *  run. */
export function simulateAgentRun({
  agentId,
  task,
  symbols,
}: SimulateRunOptions): string {
  const store = useAgentMonitorStore.getState();
  const agent = store.agents[agentId];
  if (!agent) throw new Error(`Unknown agent ${agentId}`);

  const syms = symbols?.length
    ? symbols
    : (agent.meta?.symbols as string[] | undefined) ?? ['AAPL'];
  const primary = syms[0] ?? 'AAPL';
  const resolvedTask = task ?? `Form a view on ${syms.join(', ')}`;

  const runId = store.startRun({
    agentId,
    task: resolvedTask,
    symbols: syms,
    model: (agent.meta?.model as string | undefined) ?? 'gemini-2.0-flash',
  });

  // Kick the async event stream. We intentionally don't await this — the
  // caller gets the runId right away and the UI subscribes to store events.
  void runScript(agent, runId, primary);
  return runId;
}

async function runScript(
  agent: AgentInstance,
  runId: string,
  symbol: string
): Promise<void> {
  const s = () => useAgentMonitorStore.getState();

  // ── Planning thought ──────────────────────────────────────────
  await sleep(jitter(200, 500));
  const openingId = s().emitEvent({
    agentId: agent.id,
    runId,
    kind: 'thought',
    text: '',
    partial: true,
  });
  await streamText(
    openingId,
    `Received task. Target: ${symbol}. I'll plan a short sequence of checks before concluding.`
  );

  // ── Tool sequence ─────────────────────────────────────────────
  const steps = planSteps(agent, symbol);
  const firstConclusions: string[] = [];

  for (const step of steps) {
    // Thought leading into the tool call
    await sleep(jitter(250, 500));
    const thoughtId = s().emitEvent({
      agentId: agent.id,
      runId,
      kind: 'thought',
      text: '',
      partial: true,
    });
    await streamText(thoughtId, step.thought);

    // tool_call — pending
    await sleep(jitter(150, 350));
    const callId = s().emitEvent({
      agentId: agent.id,
      runId,
      kind: 'tool_call',
      toolName: step.toolName,
      toolInput: step.toolInput,
      toolStatus: 'pending',
    });

    // Simulated latency before the tool_result arrives
    await sleep(jitter(600, 1400));
    s().emitEvent({
      agentId: agent.id,
      runId,
      kind: 'tool_result',
      parentEventId: callId,
      toolName: step.toolName,
      toolOutput: step.toolOutput,
      toolStatus: step.status,
    });

    // Small post-hoc reflection
    await sleep(jitter(150, 350));
    const reflectionId = s().emitEvent({
      agentId: agent.id,
      runId,
      kind: 'thought',
      text: '',
      partial: true,
    });
    const reflection = reflectionSnippet(step.toolName, step.toolOutput);
    await streamText(reflectionId, reflection);
    firstConclusions.push(reflection);
  }

  // ── Artifact (plot) ───────────────────────────────────────────
  await sleep(jitter(200, 500));
  s().addArtifact({
    agentId: agent.id,
    runId,
    kind: 'plot',
    title: `${symbol} — ${agent.label} tape`,
    dataUrl: buildMockPlotDataUrl(symbol),
    caption: 'Synthesised price path visualised while the agent was reasoning.',
  });

  // ── Final conclusion message ──────────────────────────────────
  await sleep(jitter(250, 500));
  const signal: 'bullish' | 'bearish' | 'neutral' =
    Math.random() > 0.65 ? 'bullish' : Math.random() > 0.5 ? 'neutral' : 'bearish';
  const confidence = Math.round((0.55 + Math.random() * 0.35) * 100) / 100;
  const conclusion =
    `**Conclusion for ${symbol}:** ${signal.toUpperCase()} · confidence ${Math.round(
      confidence * 100
    )}%.\n\n` +
    `I synthesised ${steps.length} tool call${steps.length === 1 ? '' : 's'}. ` +
    `The dominant signal is ${signal}. Main reasoning: ${firstConclusions
      .slice(0, 2)
      .join(' ')}`;

  const finalId = s().emitEvent({
    agentId: agent.id,
    runId,
    kind: 'message',
    text: '',
    partial: true,
  });
  await streamText(finalId, conclusion, { charsPerTick: 5, tickMs: 25 });

  // ── Memory append ─────────────────────────────────────────────
  const stamp = new Date().toLocaleString();
  s().appendMemory(
    agent.id,
    `\n---\n### Run on ${stamp} · ${symbol}\n- Task: _${s().runs[runId]?.task ?? ''}_\n- Signal: **${signal}** · Confidence ${Math.round(
      confidence * 100
    )}%\n- Tools used: ${steps.map((x) => x.toolName).join(', ') || 'none'}\n`
  );

  // ── Close run ─────────────────────────────────────────────────
  s().endRun(runId, {
    status: 'success',
    conclusion,
    signal,
    confidence,
  });
}

function reflectionSnippet(tool: string, output: string): string {
  const first = output.split('\n').slice(0, 2).join(' ').replace(/\s+/g, ' ');
  return `Result from \`${tool}\`: ${first} — I'll integrate this into the final view.`;
}

// ──────────────────────────────────────────── Public: mini helper ──────

export function isAgentRunning(agentId: string): boolean {
  const s = useAgentMonitorStore.getState();
  const runId = s.activeRunIdByAgent[agentId];
  if (!runId) return false;
  const run = s.runs[runId];
  return run?.status === 'running';
}
