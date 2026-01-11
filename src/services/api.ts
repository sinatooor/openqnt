/**
 * API Client Service
 * 
 * Centralized HTTP client with error handling, retry logic, and auth.
 */

export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

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
        const headers: HeadersInit = {
            "Content-Type": "application/json",
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
}

// Export singleton instance
export const api = new ApiClient();
export { ApiError };
export default api;
