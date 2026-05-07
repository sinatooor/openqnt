import { apiBase } from '@/lib/runtimeConfig';
/**
 * SEC EDGAR client.
 *
 * Public, free, no API key — but the SEC asks every caller to set a User-Agent
 * with a contact email and to throttle to ~10 req/sec. We default to a polite
 * 200ms inter-request gap when used from the server. From the browser CORS
 * blocks the official endpoints (data.sec.gov, www.sec.gov), so prefer the
 * `apiBase` form which talks to /api/edgar/* on our own backend (which proxies).
 *
 * Endpoints exposed:
 *   • lookupCik(ticker)     — symbol → CIK
 *   • companyFacts(cik)     — XBRL fundamentals (revenue, EPS, segments…)
 *   • recentFilings(cik)    — 10-K/10-Q/8-K/13F/13D/Form 4
 *   • insiderTransactions(cik) — Form-4 insider buys/sells (parsed)
 */

const API_BASE =
  apiBase();

export interface EdgarFiling {
  accessionNumber: string;
  formType: string; // "10-K", "10-Q", "8-K", "13F-HR", "SC 13G", "4", ...
  filedAt: string;  // ISO date
  reportDate?: string;
  primaryDocument?: string;
  primaryDocumentDescription?: string;
  url?: string;
}

export interface EdgarTickerInfo {
  ticker: string;
  cik: string;
  title: string;
  exchange?: string;
}

export interface InsiderTransaction {
  reporter: string;
  role: string;            // e.g. "CFO"
  isOfficer: boolean;
  isDirector: boolean;
  is10pctOwner: boolean;
  transactionType: string; // "P" (purchase), "S" (sale), "M" (option exercise), ...
  transactionDate: string;
  shares: number;
  pricePerShare: number;
  sharesOwnedAfter: number;
  link: string;
}

export interface CompanyFactValue {
  value: number;
  unit: string;
  end: string;
  form: string;
  fy: number;
  fp: string; // "FY" / "Q1" etc.
}

export interface CompanyFacts {
  cik: string;
  entityName: string;
  /** Each key is a US-GAAP concept (e.g. "Revenues", "EarningsPerShareDiluted"). */
  facts: Record<string, CompanyFactValue[]>;
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!r.ok) throw new Error(`EDGAR ${path}: ${r.status}`);
  return (await r.json()) as T;
}

/** Symbol → CIK (with leading zeros). */
export async function lookupCik(ticker: string): Promise<EdgarTickerInfo | null> {
  try {
    const data = await get<EdgarTickerInfo>(`/api/edgar/lookup/${encodeURIComponent(ticker.toUpperCase())}`);
    return data;
  } catch {
    return null;
  }
}

export async function recentFilings(cik: string, formTypes?: string[]): Promise<EdgarFiling[]> {
  const params = new URLSearchParams();
  if (formTypes && formTypes.length) params.set('forms', formTypes.join(','));
  const q = params.toString();
  return get<EdgarFiling[]>(`/api/edgar/${encodeURIComponent(cik)}/filings${q ? `?${q}` : ''}`);
}

export async function companyFacts(cik: string): Promise<CompanyFacts> {
  return get<CompanyFacts>(`/api/edgar/${encodeURIComponent(cik)}/facts`);
}

export async function insiderTransactions(cik: string, sinceDays = 90): Promise<InsiderTransaction[]> {
  return get<InsiderTransaction[]>(
    `/api/edgar/${encodeURIComponent(cik)}/insiders?since_days=${sinceDays}`
  );
}

/**
 * Pluck a series of recent values for a single concept across reporting periods.
 * Returns most-recent-first.
 */
export function recentSeries(facts: CompanyFacts, concept: string, n = 8): CompanyFactValue[] {
  const xs = facts.facts[concept];
  if (!xs) return [];
  return [...xs]
    .sort((a, b) => (a.end > b.end ? -1 : a.end < b.end ? 1 : 0))
    .slice(0, n);
}
