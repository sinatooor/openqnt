/**
 * Interactive Brokers broker client.
 * Uses the Client Portal Web API (REST) for order management,
 * portfolio, and account data.
 *
 * Auth modes:
 *   - CP Gateway: local Java gateway routes requests with session auth
 *   - OAuth 2.0: direct REST with access tokens (institutional)
 *
 * Symbols use conid (contract ID) internally. A lookup cache maps
 * ticker strings to conids.
 */

import { logger } from '../utils/logger.js';
import type { Bar } from '../engine/interpreter.js';
import type {
    BrokerClient,
    BrokerOrder,
    BrokerOrderResult,
    BrokerPosition,
    BrokerAccountInfo,
} from '../services/brokerGateway.js';

const DEFAULT_GATEWAY_URL = 'https://localhost:5000/v1/api';
const LIVE_OAUTH_URL = 'https://api.ibkr.com/v1/api';
const REQUEST_TIMEOUT = 15_000;

type AuthMode = 'gateway' | 'oauth';

interface IbkrConfig {
    authMode: AuthMode;
    gatewayUrl?: string;
    accessToken?: string;
    accountId?: string;
}

export class IbkrClient implements BrokerClient {
    name = 'ibkr';
    private connected = false;
    private config: IbkrConfig = { authMode: 'gateway' };
    private baseUrl = DEFAULT_GATEWAY_URL;
    private headers: Record<string, string> = { 'Content-Type': 'application/json' };
    private accountId = '';
    private conidCache = new Map<string, number>();

    async connect(apiKey: string, apiSecret?: string): Promise<void> {
        // apiKey = gateway URL or OAuth access token
        // apiSecret = account ID (optional, auto-discovered)
        if (apiKey.startsWith('http')) {
            this.config = { authMode: 'gateway', gatewayUrl: apiKey, accountId: apiSecret };
            this.baseUrl = apiKey;
        } else {
            this.config = { authMode: 'oauth', accessToken: apiKey, accountId: apiSecret };
            this.baseUrl = LIVE_OAUTH_URL;
            this.headers['Authorization'] = `Bearer ${apiKey}`;
        }

        try {
            await this.tickle();
            const accounts = await this.discoverAccounts();
            this.accountId = this.config.accountId ?? accounts[0] ?? '';
            if (!this.accountId) throw new Error('No IBKR accounts found');
            this.connected = true;
            logger.info({ broker: this.name, accountId: this.accountId, authMode: this.config.authMode }, 'IBKR connected');
        } catch (err: any) {
            throw new Error(`IBKR connection failed: ${err.message}`);
        }
    }

    async disconnect(): Promise<void> {
        if (this.config.authMode === 'gateway') {
            try { await this.request('POST', '/logout'); } catch { /* best effort */ }
        }
        this.connected = false;
        this.headers = { 'Content-Type': 'application/json' };
    }

    isConnected(): boolean {
        return this.connected;
    }

    // ─── Account ────────────────────────────────────────────────

    async getAccount(): Promise<BrokerAccountInfo> {
        const summary = await this.request<any[]>('GET', `/portfolio/${this.accountId}/summary`);
        const ledger = await this.request<Record<string, any>>('GET', `/portfolio/${this.accountId}/ledger`);
        const base = ledger?.BASE ?? ledger?.USD ?? {};

        return {
            accountId: this.accountId,
            cash: base.cashbalance ?? base.netliquidationvalue ?? 0,
            equity: base.netliquidationvalue ?? 0,
            buyingPower: base.buyingpower ?? base.netliquidationvalue ?? 0,
            status: this.connected ? 'ACTIVE' : 'DISCONNECTED',
        };
    }

    // ─── Orders ─────────────────────────────────────────────────

    async submitOrder(order: BrokerOrder): Promise<BrokerOrderResult> {
        const conid = await this.resolveConid(order.symbol);
        const orderPayload = {
            acctId: this.accountId,
            conid,
            secType: `${conid}:STK`,
            orderType: this.mapOrderType(order.type),
            side: order.side.toUpperCase(),
            quantity: order.quantity,
            tif: this.mapTimeInForce(order.timeInForce ?? 'day'),
            ...(order.limitPrice ? { price: order.limitPrice } : {}),
            ...(order.stopPrice ? { auxPrice: order.stopPrice } : {}),
            ...(order.clientOrderId ? { cOID: order.clientOrderId } : {}),
        };

        const resp = await this.request<any[]>('POST', `/iserver/account/${this.accountId}/orders`, {
            orders: [orderPayload],
        });

        const first = Array.isArray(resp) ? resp[0] : resp;

        // IBKR may return a confirmation question
        if (first?.id && first?.message) {
            logger.info({ orderId: first.id }, 'IBKR order requires confirmation, auto-confirming');
            const confirmResp = await this.request<any[]>('POST', `/iserver/reply/${first.id}`, { confirmed: true });
            const confirmed = Array.isArray(confirmResp) ? confirmResp[0] : confirmResp;
            return this.parseOrderResult(confirmed, order);
        }

        return this.parseOrderResult(first, order);
    }

    async cancelOrder(orderId: string): Promise<void> {
        await this.request('DELETE', `/iserver/account/${this.accountId}/order/${orderId}`);
        logger.info({ orderId, broker: this.name }, 'IBKR order cancelled');
    }

    async getOpenOrders(): Promise<BrokerOrderResult[]> {
        const orders = await this.request<any>('GET', '/iserver/account/orders');
        const list = orders?.orders ?? [];
        return list.map((o: any) => ({
            orderId: String(o.orderId ?? o.order_id ?? ''),
            status: this.mapOrderStatus(o.status),
            filledQuantity: o.filledQuantity ?? o.filled ?? 0,
            filledPrice: o.avgPrice ?? o.avgFillPrice ?? 0,
            rawResponse: o,
        }));
    }

    // ─── Positions ──────────────────────────────────────────────

    async getPositions(): Promise<BrokerPosition[]> {
        const data = await this.request<any[]>('GET', `/portfolio/${this.accountId}/positions/0`);
        if (!Array.isArray(data)) return [];

        return data.map((p) => ({
            symbol: p.contractDesc ?? p.ticker ?? String(p.conid),
            side: (p.position ?? 0) >= 0 ? 'long' as const : 'short' as const,
            quantity: Math.abs(p.position ?? 0),
            avgEntryPrice: p.avgCost ?? p.avgPrice ?? 0,
            currentPrice: p.mktPrice ?? 0,
            unrealizedPnl: p.unrealizedPnl ?? 0,
            marketValue: p.mktValue ?? 0,
        }));
    }

    async closePosition(symbol: string): Promise<BrokerOrderResult> {
        const positions = await this.getPositions();
        const pos = positions.find((p) => p.symbol.toUpperCase().includes(symbol.toUpperCase()));
        if (!pos) {
            return { orderId: '', status: 'rejected', filledQuantity: 0, filledPrice: 0, message: 'Position not found' };
        }
        const side = pos.side === 'long' ? 'sell' : 'buy';
        return this.submitOrder({ symbol, side, type: 'market', quantity: pos.quantity });
    }

    async closeAllPositions(): Promise<BrokerOrderResult[]> {
        const positions = await this.getPositions();
        const results: BrokerOrderResult[] = [];
        for (const pos of positions) {
            const result = await this.closePosition(pos.symbol);
            results.push(result);
        }
        return results;
    }

    // ─── Helpers ─────────────────────────────────────────────────

    private async request<T>(method: string, path: string, body?: any): Promise<T> {
        const url = `${this.baseUrl}${path}`;
        const options: RequestInit = {
            method,
            headers: this.headers,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT),
        };
        if (body) options.body = JSON.stringify(body);

        const response = await fetch(url, options);
        if (!response.ok) {
            const text = await response.text();
            throw new Error(`IBKR ${method} ${path}: ${response.status} — ${text}`);
        }
        const text = await response.text();
        if (!text) return {} as T;
        return JSON.parse(text) as T;
    }

    /** Keep the gateway session alive */
    private async tickle(): Promise<void> {
        await this.request('POST', '/tickle');
    }

    /** Discover available account IDs */
    private async discoverAccounts(): Promise<string[]> {
        const data = await this.request<any>('GET', '/iserver/accounts');
        return data?.accounts ?? [];
    }

    /** Resolve a ticker symbol to an IBKR conid */
    private async resolveConid(symbol: string): Promise<number> {
        if (this.conidCache.has(symbol)) return this.conidCache.get(symbol)!;

        const results = await this.request<any[]>('GET', `/iserver/secdef/search?symbol=${encodeURIComponent(symbol)}`);
        if (!results?.length) throw new Error(`No IBKR contract found for symbol: ${symbol}`);

        const match = results.find((r: any) =>
            r.description?.toUpperCase().includes('COMMON') ||
            r.sections?.some((s: any) => s.secType === 'STK')
        ) ?? results[0];

        const conid = match.conid ?? match.conId;
        if (!conid) throw new Error(`Could not resolve conid for: ${symbol}`);

        this.conidCache.set(symbol, conid);
        return conid;
    }

    private mapOrderType(type: BrokerOrder['type']): string {
        const map: Record<string, string> = { market: 'MKT', limit: 'LMT', stop: 'STP', stop_limit: 'STP_LMT' };
        return map[type] ?? 'MKT';
    }

    private mapTimeInForce(tif: string): string {
        const map: Record<string, string> = { day: 'DAY', gtc: 'GTC', ioc: 'IOC', fok: 'FOK' };
        return map[tif] ?? 'DAY';
    }

    private mapOrderStatus(ibkrStatus: string): 'accepted' | 'rejected' | 'pending' {
        const s = (ibkrStatus ?? '').toLowerCase();
        if (['submitted', 'filled', 'presubmitted'].includes(s)) return 'accepted';
        if (['cancelled', 'inactive', 'apicancelled'].includes(s)) return 'rejected';
        return 'pending';
    }

    private parseOrderResult(resp: any, order: BrokerOrder): BrokerOrderResult {
        const orderId = String(resp?.order_id ?? resp?.orderId ?? resp?.id ?? `ibkr_${Date.now()}`);
        const status = resp?.order_status
            ? this.mapOrderStatus(resp.order_status)
            : 'accepted';

        logger.info({ orderId, symbol: order.symbol, side: order.side, qty: order.quantity }, 'IBKR order submitted');

        return {
            orderId,
            status,
            filledQuantity: resp?.filledQuantity ?? 0,
            filledPrice: resp?.avgPrice ?? order.limitPrice ?? 0,
            rawResponse: resp,
        };
    }

    async getBars(symbol: string, timeframe: string, limit: number): Promise<Bar[]> {
        // IBKR Client Portal API doesn't expose simple bar endpoints.
        // Fall back to the Python compute service (yfinance) for market data.
        const { fetchMarketBars } = await import('../services/computeClient.js');
        const result = await fetchMarketBars({ symbol, timeframe, limit });
        return result.data.bars;
    }
}
