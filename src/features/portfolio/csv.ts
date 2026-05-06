/**
 * CSV utilities for portfolio import/export.
 *
 * Import: parses a CSV with a flexible header → field mapping. Recognized
 * column synonyms cover the major retail brokers (Fidelity, Schwab, Robinhood,
 * IBKR, Alpaca) so most exports load without manual mapping.
 *
 * Export: writes a tax-style realized-gain/loss CSV (one row per consumed lot
 * slice, short-term and long-term tagged).
 */
import type {
  AssetType,
  PortfolioHolding,
  RealizedSale,
} from '@/stores/portfolioStore';

// ─── Parser ─────────────────────────────────────────────────

/** Minimal CSV parser handling quoted fields, escaped quotes, and CRLF. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch === '\r') {
      // skip; next \n will close the row
    } else {
      cell += ch;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  // Drop trailing empty row if file ended with newline
  if (rows.length && rows[rows.length - 1].length === 1 && rows[rows.length - 1][0] === '') {
    rows.pop();
  }
  return rows;
}

// ─── Header synonyms ────────────────────────────────────────

type FieldKey = 'symbol' | 'name' | 'quantity' | 'avgCost' | 'currency' | 'assetType' | 'date' | 'fees';

const HEADER_SYNONYMS: Record<FieldKey, string[]> = {
  symbol: ['symbol', 'ticker', 'security', 'sec id', 'asset', 'instrument'],
  name: ['name', 'description', 'security description', 'company'],
  quantity: ['quantity', 'qty', 'shares', 'units', 'amount'],
  avgCost: ['avg cost', 'avg cost basis', 'cost basis per share', 'price', 'avg price', 'cost', 'unit cost', 'purchase price'],
  currency: ['currency', 'ccy'],
  assetType: ['asset type', 'type', 'category', 'class'],
  date: ['date', 'opened', 'open date', 'purchase date', 'acquired', 'trade date'],
  fees: ['fees', 'commission', 'commissions'],
};

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ');
}

/** Build the column → field map for a given header row. */
export function inferColumnMap(headers: string[]): Partial<Record<FieldKey, number>> {
  const map: Partial<Record<FieldKey, number>> = {};
  const norm = headers.map(normalizeHeader);
  for (const [field, syns] of Object.entries(HEADER_SYNONYMS) as [FieldKey, string[]][]) {
    for (const syn of syns) {
      const idx = norm.indexOf(syn);
      if (idx >= 0) {
        map[field] = idx;
        break;
      }
    }
  }
  return map;
}

const ASSET_TYPE_SYNONYMS: Record<string, AssetType> = {
  stock: 'stock', equity: 'stock', shares: 'stock', common: 'stock',
  etf: 'etf', etn: 'etf', fund: 'etf',
  crypto: 'crypto', cryptocurrency: 'crypto', token: 'crypto', coin: 'crypto',
  bond: 'bond', note: 'bond', treasury: 'bond', tbill: 'bond',
  cash: 'cash', money: 'cash', mmkt: 'cash',
  forex: 'forex', fx: 'forex', currency: 'forex',
  gold: 'gold',
  commodity: 'commodity', commodities: 'commodity',
};

function inferAssetType(raw: string | undefined, symbol: string): AssetType {
  if (raw) {
    const k = raw.trim().toLowerCase();
    if (ASSET_TYPE_SYNONYMS[k]) return ASSET_TYPE_SYNONYMS[k];
  }
  // Light heuristics from symbol
  const s = symbol.toUpperCase();
  if (/^(BTC|ETH|SOL|XRP|ADA|DOGE|MATIC|AVAX|DOT|LTC)$/.test(s)) return 'crypto';
  if (/^(XAU|GOLD)$/.test(s)) return 'gold';
  if (/USD$|EUR$|GBP$|JPY$/.test(s) && s.length === 6) return 'forex';
  return 'stock';
}

export interface ImportedRow {
  symbol: string;
  name: string;
  assetType: AssetType;
  quantity: number;
  avgCost: number;
  currency: string;
  openedAt?: number;
  fees?: number;
  rowIndex: number;
  errors: string[];
}

export function parsePortfolioCsv(text: string): {
  rows: ImportedRow[];
  headers: string[];
  columnMap: Partial<Record<FieldKey, number>>;
} {
  const grid = parseCSV(text);
  if (grid.length === 0) {
    return { rows: [], headers: [], columnMap: {} };
  }
  const headers = grid[0].map((h) => h.trim());
  const columnMap = inferColumnMap(headers);
  const rows: ImportedRow[] = [];

  for (let r = 1; r < grid.length; r++) {
    const cols = grid[r];
    if (cols.length === 0 || cols.every((c) => !c.trim())) continue;

    const get = (k: FieldKey): string | undefined => {
      const idx = columnMap[k];
      return idx === undefined ? undefined : cols[idx]?.trim();
    };

    const errors: string[] = [];
    const symbol = (get('symbol') ?? '').toUpperCase();
    if (!symbol) errors.push('missing symbol');

    const qtyRaw = get('quantity');
    const qty = qtyRaw ? parseFloat(qtyRaw.replace(/,/g, '')) : NaN;
    if (!Number.isFinite(qty) || qty <= 0) errors.push('invalid quantity');

    const costRaw = get('avgCost');
    const cleanedCost = costRaw ? costRaw.replace(/[^\d.\-]/g, '') : '';
    const avgCost = cleanedCost ? parseFloat(cleanedCost) : NaN;
    if (!Number.isFinite(avgCost) || avgCost < 0) errors.push('invalid avg cost');

    const currency = (get('currency') ?? 'USD').toUpperCase().slice(0, 4) || 'USD';
    const assetType = inferAssetType(get('assetType'), symbol);

    let openedAt: number | undefined;
    const dateRaw = get('date');
    if (dateRaw) {
      const t = Date.parse(dateRaw);
      if (Number.isFinite(t)) openedAt = t;
    }

    const feesRaw = get('fees');
    const fees = feesRaw ? parseFloat(feesRaw.replace(/[^\d.\-]/g, '')) : undefined;

    rows.push({
      symbol,
      name: get('name') || symbol,
      assetType,
      quantity: Number.isFinite(qty) ? qty : 0,
      avgCost: Number.isFinite(avgCost) ? avgCost : 0,
      currency,
      openedAt,
      fees: Number.isFinite(fees as number) ? fees : undefined,
      rowIndex: r,
      errors,
    });
  }

  return { rows, headers, columnMap };
}

// ─── Export: realized gain/loss CSV ─────────────────────────

/** Build a tax-style realized gain/loss CSV. One row per consumed lot slice. */
export function realizedGainLossCsv(sales: RealizedSale[]): string {
  const header = [
    'Sale Date',
    'Symbol',
    'Quantity',
    'Sale Price / unit',
    'Sale Proceeds (net of fees)',
    'Lot Opened',
    'Days Held',
    'Term',
    'Cost Basis / unit',
    'Cost Basis (slice)',
    'Realized P&L (slice)',
  ];
  const lines: string[] = [header.join(',')];

  for (const s of sales) {
    const proceedsPerUnit = s.qty > 0 ? s.proceeds / s.qty : 0;
    for (const c of s.consumed) {
      const sliceCost = c.qty * c.pricePerUnit;
      const sliceProceeds = c.qty * proceedsPerUnit;
      const slicePnL = sliceProceeds - sliceCost;
      lines.push(
        [
          new Date(s.closedAt).toISOString().slice(0, 10),
          csvField(s.symbol),
          fmtRaw(c.qty),
          fmtRaw(s.salePrice),
          fmtRaw(sliceProceeds),
          new Date(c.openedAt).toISOString().slice(0, 10),
          String(c.daysHeld),
          c.longTerm ? 'LT' : 'ST',
          fmtRaw(c.pricePerUnit),
          fmtRaw(sliceCost),
          fmtRaw(slicePnL),
        ].join(',')
      );
    }
  }
  return lines.join('\n');
}

/** Build a holdings snapshot CSV (e.g. for archival or to round-trip into another tool). */
export function holdingsSnapshotCsv(holdings: PortfolioHolding[]): string {
  const header = [
    'Symbol',
    'Name',
    'Asset Type',
    'Quantity',
    'Avg Cost',
    'Current Price',
    'Currency',
    'Lots',
  ];
  const lines: string[] = [header.join(',')];
  for (const h of holdings) {
    lines.push(
      [
        csvField(h.symbol),
        csvField(h.name),
        h.assetType,
        fmtRaw(h.quantity),
        fmtRaw(h.avgCost),
        fmtRaw(h.currentPrice || h.avgCost),
        h.currency,
        String(h.lots?.length ?? 0),
      ].join(',')
    );
  }
  return lines.join('\n');
}

function fmtRaw(n: number): string {
  if (!Number.isFinite(n)) return '';
  return n.toFixed(4).replace(/\.?0+$/, '');
}

function csvField(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Trigger a browser download for a CSV string. */
export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
