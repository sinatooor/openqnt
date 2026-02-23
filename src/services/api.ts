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
        return this.get<{ status: string }>("/api/health");
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
}

// Export singleton instance
export const api = new ApiClient();
export { ApiError };
export default api;
