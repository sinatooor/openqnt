/**
 * API Client Service
 * 
 * Centralized HTTP client with error handling, retry logic, and auth.
 */

export const API_BASE_URL = import.meta.env.VITE_ORCHESTRATOR_URL || "http://localhost:3000";

interface RequestConfig extends RequestInit {
    retries?: number;
    retryDelay?: number;
}

interface ApiResponse<T> {
    data: T;
    status: number;
    ok: boolean;
}

class ApiError extends Error {
    constructor(
        message: string,
        public status: number,
        public data?: any
    ) {
        super(message);
        this.name = "ApiError";
    }
}

async function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

class ApiClient {
    private baseUrl: string;

    constructor(baseUrl: string = API_BASE_URL) {
        this.baseUrl = baseUrl;
    }

    private async request<T>(
        endpoint: string,
        config: RequestConfig = {}
    ): Promise<ApiResponse<T>> {
        const { retries = 2, retryDelay = 1000, ...fetchConfig } = config;

        const url = `${this.baseUrl}${endpoint}`;

        // Auto-inject JWT auth header
        const authHeaders: Record<string, string> = {};
        try {
            const authState = JSON.parse(localStorage.getItem('strategyflow-auth') || '{}');
            if (authState?.state?.accessToken) {
                authHeaders['Authorization'] = `Bearer ${authState.state.accessToken}`;
            }
        } catch { /* no auth */ }

        const headers: HeadersInit = {
            "Content-Type": "application/json",
            ...authHeaders,
            ...fetchConfig.headers,
        };

        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= retries; attempt++) {
            try {
                const response = await fetch(url, {
                    ...fetchConfig,
                    headers,
                });

                const data = await response.json().catch(() => null);

                if (!response.ok) {
                    throw new ApiError(
                        data?.detail || data?.message || `Request failed with status ${response.status}`,
                        response.status,
                        data
                    );
                }

                return {
                    data,
                    status: response.status,
                    ok: true,
                };
            } catch (error) {
                lastError = error as Error;

                // Don't retry on 4xx errors
                if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
                    throw error;
                }

                // Retry on network errors or 5xx
                if (attempt < retries) {
                    await sleep(retryDelay * (attempt + 1));
                }
            }
        }

        throw lastError || new Error("Request failed");
    }

    async get<T>(endpoint: string, config?: RequestConfig): Promise<T> {
        const response = await this.request<T>(endpoint, { ...config, method: "GET" });
        return response.data;
    }

    async post<T>(endpoint: string, body?: any, config?: RequestConfig): Promise<T> {
        const response = await this.request<T>(endpoint, {
            ...config,
            method: "POST",
            body: body ? JSON.stringify(body) : undefined,
        });
        return response.data;
    }

    async put<T>(endpoint: string, body?: any, config?: RequestConfig): Promise<T> {
        const response = await this.request<T>(endpoint, {
            ...config,
            method: "PUT",
            body: body ? JSON.stringify(body) : undefined,
        });
        return response.data;
    }

    async delete<T>(endpoint: string, config?: RequestConfig): Promise<T> {
        const response = await this.request<T>(endpoint, { ...config, method: "DELETE" });
        return response.data;
    }

    // Convenience methods for common endpoints

    async healthCheck() {
        return this.get<{ status: string }>("/health");
    }

    async runBacktest(params: any) {
        return this.post<any>("/api/backtest", params);
    }

    async startStrategy(params: any) {
        return this.post<any>("/strategy/start", params);
    }

    async stopStrategy() {
        return this.post<any>("/strategy/stop");
    }

    async getStrategyStatus() {
        return this.get<any>("/strategy/status");
    }

    async getTrades(params?: { limit?: number; symbol?: string }) {
        const query = new URLSearchParams();
        if (params?.limit) query.append("limit", params.limit.toString());
        if (params?.symbol) query.append("symbol", params.symbol);
        return this.get<any[]>(`/api/trades?${query}`);
    }

    async exportStrategy(format: string, workspaceXml: string) {
        return this.post<any>("/api/export", { format, workspaceXml });
    }

    // ── Orchestrator API Methods ──────────────────────────

    // Strategies (new orchestrator endpoints)
    async listStrategies() {
        return this.get<any>('/api/strategies');
    }

    async getStrategy(id: string) {
        return this.get<any>(`/api/strategies/${id}`);
    }

    async saveStrategy(strategy: any) {
        return this.post<any>('/api/strategies', strategy);
    }

    async updateStrategy(id: string, data: any) {
        return this.put<any>(`/api/strategies/${id}`, data);
    }

    async deleteStrategy(id: string) {
        return this.delete<any>(`/api/strategies/${id}`);
    }

    async compileStrategy(id: string) {
        return this.post<any>(`/api/strategies/${id}/compile`);
    }

    async validateStrategy(id: string) {
        return this.post<any>(`/api/strategies/${id}/validate`);
    }

    async deployStrategy(id: string) {
        return this.post<any>(`/api/strategies/${id}/deploy`);
    }

    async pauseStrategy(id: string) {
        return this.post<any>(`/api/strategies/${id}/pause`);
    }

    // Executions
    async executeStrategy(strategyId: string, triggerData?: Record<string, any>) {
        return this.post<any>(`/api/executions/strategies/${strategyId}/execute`, { triggerData });
    }

    async listExecutions(params?: { page?: number; strategyId?: string; status?: string }) {
        const query = new URLSearchParams();
        if (params?.page) query.set('page', String(params.page));
        if (params?.strategyId) query.set('strategyId', params.strategyId);
        if (params?.status) query.set('status', params.status);
        return this.get<any>(`/api/executions?${query}`);
    }

    async getExecution(id: string) {
        return this.get<any>(`/api/executions/${id}`);
    }

    async getExecutionStats() {
        return this.get<any>('/api/executions/stats/summary');
    }

    // Portfolio
    async getPortfolios() {
        return this.get<any>('/api/portfolio');
    }

    async getPortfolio(id: string) {
        return this.get<any>(`/api/portfolio/${id}`);
    }

    async syncPortfolio(id: string) {
        return this.put<any>(`/api/portfolio/${id}/sync`);
    }

    async createPortfolioHolding(data: { symbol: string; name: string; assetType: string; quantity: number; avgCost: number; currency: string }) {
        return this.post<any>('/api/portfolio/holdings', data);
    }

    async deletePortfolioHolding(id: string) {
        return this.delete<any>(`/api/portfolio/holdings/${id}`);
    }

    async getPortfolioPrices(symbols: string[]) {
        return this.post<any>('/api/portfolio/prices', { symbols });
    }

    async getPortfolioHistory(params?: { days?: number }) {
        const query = new URLSearchParams();
        if (params?.days) query.set('days', String(params.days));
        return this.get<any>(`/api/portfolio/history?${query}`);
    }

    async getPortfolioAnalytics() {
        return this.get<any>('/api/portfolio/analytics');
    }

    // Credentials
    async listCredentials() {
        return this.get<any>('/api/credentials');
    }

    async storeCredential(data: { alias: string; provider: string; apiKey: string; apiSecret?: string }) {
        return this.post<any>('/api/credentials', data);
    }

    async deleteCredential(id: string) {
        return this.delete<any>(`/api/credentials/${id}`);
    }

    // Agent Config
    async getAgentConfig() {
        return this.get<any>('/api/agent/config');
    }

    async updateAgentConfig(config: any) {
        return this.put<any>('/api/agent/config', config);
    }

    async emergencyKill() {
        return this.post<any>('/api/agent/kill');
    }

    // AI
    async analyze(data: { agentType: string; strategyId?: string; context?: any }) {
        return this.post<any>('/api/ai/analyze', data);
    }

    async getComputeHealth() {
        return this.get<any>('/api/ai/health');
    }

    // Research & Quant Tools
    async runMCPT(params: { symbol: string, startDate: string, endDate: string, timeframe?: string, permutations?: number }) {
        return this.post<any>('/api/research/mcpt', params);
    }

    // Data Events (News Feed)
    async listDataEvents(params?: { type?: string; symbol?: string; impact?: string; limit?: number; offset?: number }) {
        const query = new URLSearchParams();
        if (params?.type) query.set('type', params.type);
        if (params?.symbol) query.set('symbol', params.symbol);
        if (params?.impact) query.set('impact', params.impact);
        if (params?.limit) query.set('limit', String(params.limit));
        if (params?.offset) query.set('offset', String(params.offset));
        return this.get<any>(`/api/data-events?${query}`);
    }

    // Approvals (HITL Queue)
    async listPendingApprovals() {
        return this.get<any>('/api/approvals/pending');
    }

    async approveRequest(approvalId: string, notes?: string) {
        return this.post<any>(`/api/approvals/${approvalId}/approve`, { notes });
    }

    async rejectRequest(approvalId: string, notes?: string) {
        return this.post<any>(`/api/approvals/${approvalId}/reject`, { notes });
    }

    async getApprovalHistory(params?: { page?: number }) {
        const query = new URLSearchParams();
        if (params?.page) query.set('page', String(params.page));
        return this.get<any>(`/api/approvals/history?${query}`);
    }

    // ── AI Assistant (Global Chat) ─────────────────────────────

    /**
     * Stream a chat message to the AI assistant via SSE.
     * Returns a ReadableStream of parsed SSE events.
     */
    streamAiChat(
        message: string,
        history: { role: string; content: string }[],
        context?: Record<string, any>,
        onEvent?: (event: AiChatEvent) => void,
        signal?: AbortSignal,
    ): { cancel: () => void } {
        const baseUrl = this.baseUrl;
        const controller = new AbortController();
        const combinedSignal = signal || controller.signal;

        const authHeaders: Record<string, string> = {};
        try {
            const authState = JSON.parse(localStorage.getItem('strategyflow-auth') || '{}');
            if (authState?.state?.accessToken) {
                authHeaders['Authorization'] = `Bearer ${authState.state.accessToken}`;
            }
        } catch {
            // no-op
        }

        (async () => {
            let sawDone = false;
            let aborted = false;
            try {
                const response = await fetch(`${baseUrl}/api/ai-assistant/chat/stream`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        ...authHeaders,
                    },
                    body: JSON.stringify({ message, history, context }),
                    signal: combinedSignal,
                });

                if (!response.ok) {
                    onEvent?.({ type: 'error', message: `HTTP ${response.status}` });
                    sawDone = true;
                    return;
                }

                const reader = response.body?.getReader();
                if (!reader) {
                    onEvent?.({ type: 'error', message: 'No response body' });
                    sawDone = true;
                    return;
                }

                const decoder = new TextDecoder();
                let buffer = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const event = JSON.parse(line.slice(6)) as AiChatEvent;
                                if (event.type === 'done' || event.type === 'error') sawDone = true;
                                onEvent?.(event);
                            } catch { /* skip malformed events */ }
                        }
                    }
                }
            } catch (err: any) {
                if (err.name === 'AbortError') {
                    aborted = true;
                } else {
                    onEvent?.({ type: 'error', message: err.message || 'Stream failed' });
                    sawDone = true;
                }
            } finally {
                // Synthesise a terminal event so the consumer never gets
                // stuck in "streaming" state when the connection drops
                // before the server sends `done` (e.g. flaky network,
                // backend crash mid-token).
                if (!sawDone && !aborted) {
                    onEvent?.({ type: 'error', message: 'Stream ended unexpectedly' });
                }
                if (!aborted) {
                    onEvent?.({ type: 'done' });
                }
            }
        })();

        return { cancel: () => controller.abort() };
    }
}

// AI Chat SSE event types
export type AiChatEvent =
    | { type: 'text_delta'; content: string }
    | { type: 'tool_call'; tool: string; args: Record<string, any> }
    | { type: 'tool_result'; tool: string; result: Record<string, any> }
    | { type: 'strategy_node'; node: any; index: number; total: number }
    | { type: 'strategy_edges'; edges: any[] }
    | { type: 'action'; action: string; data: Record<string, any> }
    | { type: 'done' }
    | { type: 'error'; message: string };

// Export singleton instance
export const api = new ApiClient();
export { ApiError };
export default api;
