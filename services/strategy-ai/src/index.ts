/**
 * Strategy AI sidecar — HTTP entrypoint.
 *
 * One endpoint for now: `POST /agent/run` accepts `{message, draft, history}`,
 * runs the Builder agent, and streams events via Server-Sent Events. The
 * Python backend (`backend/routers/ai_assistant.py`) is expected to spawn this
 * process and forward chat messages here as a tool.
 *
 * Runs via Bun: `bun src/index.ts` or `bun --watch src/index.ts`.
 */

import { loadEnvFiles } from './env-bootstrap';
loadEnvFiles();

import { runBuilder, type BuilderRunResult } from './builder/loop';
import type { BuilderEvent } from './builder/tools';
import { PythonBridge } from './python-bridge';
import { resolveModel } from './builder/model';
import type { StrategyDraft } from './types/strategy-draft';

const PORT = Number(process.env.STRATEGY_AI_PORT ?? 3050);
const PY_URL = process.env.STRATEGY_PY_URL ?? 'http://127.0.0.1:8000';

interface AgentRunRequest {
  message: string;
  draft?: StrategyDraft;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

const sseHeaders = {
  'content-type': 'text/event-stream',
  'cache-control': 'no-cache',
  'connection': 'keep-alive',
  // The Python backend proxies events to the browser; if you ever talk to this
  // service directly from a browser, also need CORS — left disabled by default
  // because the recommended seam is Python → this service.
};

const writeSse = (controller: ReadableStreamDefaultController, event: string, data: unknown) => {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  controller.enqueue(new TextEncoder().encode(payload));
};

const handleAgentRun = async (req: Request): Promise<Response> => {
  let body: AgentRunRequest;
  try {
    body = (await req.json()) as AgentRunRequest;
  } catch (err) {
    return new Response(JSON.stringify({ error: `invalid json: ${(err as Error).message}` }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (!body.message || typeof body.message !== 'string') {
    return new Response(JSON.stringify({ error: 'message is required' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  const bridge = new PythonBridge(PY_URL);
  const { model, provider, modelId } = resolveModel();

  const stream = new ReadableStream({
    async start(controller) {
      writeSse(controller, 'run_start', { provider, modelId });

      const onEvent = (e: BuilderEvent) => writeSse(controller, e.kind, e);

      let result: BuilderRunResult;
      try {
        result = await runBuilder(
          {
            message: body.message,
            initialDraft: body.draft,
            history: body.history?.map((m) => ({ role: m.role, content: m.content })),
          },
          { bridge, model, onEvent },
        );
      } catch (err) {
        writeSse(controller, 'error', { message: (err as Error).message });
        controller.close();
        return;
      }

      writeSse(controller, 'run_complete', {
        draft: result.draft,
        summary: result.summary,
        validateCount: result.validateCount,
        blockedByLoopGuard: result.blockedByLoopGuard,
      });
      controller.close();
    },
  });

  return new Response(stream, { headers: sseHeaders });
};

const handleHealth = async (): Promise<Response> => {
  const bridge = new PythonBridge(PY_URL);
  let pythonReachable = false;
  let pythonError: string | undefined;
  try {
    await bridge.getCatalog();
    pythonReachable = true;
  } catch (e) {
    pythonError = (e as Error).message;
  }
  const { provider, modelId } = resolveModel();
  return Response.json({
    status: 'ok',
    provider,
    modelId,
    pythonBackend: { url: PY_URL, reachable: pythonReachable, error: pythonError },
  });
};

Bun.serve({
  port: PORT,
  // SSE streams for `/agent/run` can sit quiet for >10s while the LLM
  // thinks or while a Python /verify-mock call runs. Bun's default
  // idleTimeout (10s) was killing those mid-stream. 240s gives long
  // Claude Sonnet runs (~3-5 minutes total when many lookup_node_schema
  // calls are needed) headroom.
  idleTimeout: 240,
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === 'GET' && url.pathname === '/health') return handleHealth();
    if (req.method === 'POST' && url.pathname === '/agent/run') return handleAgentRun(req);
    return new Response('not found', { status: 404 });
  },
});

console.log(`[strategy-ai] listening on http://127.0.0.1:${PORT}  python=${PY_URL}`);
