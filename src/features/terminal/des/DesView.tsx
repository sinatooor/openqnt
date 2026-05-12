/**
 * DesView — Bloomberg-style DES (Company Description) screen.
 *
 * Layout:
 *   ┌───────────────── focal strip (ticker, name, industry, price) ─────────┐
 *   ├──────────── LEFT column ───────────┬────────── RIGHT column ──────────┤
 *   │ Business description              │ Financial highlights (TTM)        │
 *   │ Revenue segments (bar chart)      │ Valuation & trading stats         │
 *   │ Key executives (table)            │ Price range + share structure     │
 *   ├───────────────────────────────────┴───────────────────────────────────┤
 *   │ Corporate info (identifiers, HQ/contact, listing, sector/industry)    │
 *   ├───────────────────────────────────────────────────────────────────────┤
 *   │ Highlights / Risks / Catalysts (3-column narrative)                    │
 *   └────────────────────────────────────────────────────────────────────────┘
 *
 * The view consumes `desTool.fetch(...)` so UI + agent share identical data.
 */

import { desTool } from './tool';
import { generateDesData } from './mockData';
import { useTerminalData } from '../useTerminalData';
import './des.css';

export interface DesViewProps {
  ticker: string;
  seedSalt?: number;
}

function fmtNum(n: number, decimals = 2): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// Format helpers tolerate null/undefined — backend can omit any of these
// fields (e.g. private placements with no prev close). Previously these
// crashed the entire DesView with "Cannot read properties of null (reading
// 'toFixed')".
function fmtUsdB(b: number | null | undefined): string {
  if (b === null || b === undefined || !Number.isFinite(b)) return '—';
  if (Math.abs(b) >= 1000) return `$${(b / 1000).toFixed(2)}T`;
  return `$${b.toFixed(2)}B`;
}

function signedPct(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const v = `${n.toFixed(decimals)}%`;
  return n > 0 ? `+${v}` : v;
}

function deltaClass(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return 'des-flat';
  if (n > 0.0005) return 'des-up';
  if (n < -0.0005) return 'des-down';
  return 'des-flat';
}

export default function DesView({ ticker, seedSalt = 0 }: DesViewProps) {
  const data = useTerminalData(
    desTool,
    { ticker, seedSalt },
    () => generateDesData({ ticker, seedSalt }),
  );

  const { center: c, financials: f, valuation: v, segments, executives, highlights, risks, catalysts } = data;

  // 52-week range marker position, clamped 0..100. Any null field collapses
  // the calc to 0 — the band still renders, just without a marker.
  const rangePos = (() => {
    if (
      v.price === null || v.price === undefined ||
      v.w52Low === null || v.w52Low === undefined ||
      v.w52High === null || v.w52High === undefined
    ) return 0;
    return Math.max(
      0,
      Math.min(100, ((v.price - v.w52Low) / Math.max(0.0001, v.w52High - v.w52Low)) * 100),
    );
  })();

  return (
    <div className="des-root">
      {/* -------------------------- focal strip --------------------------- */}
      <div className="des-focal">
        <div className="des-focal-left">
          <div className="des-focal-ticker-row">
            <span className="des-focal-ticker">{c.ticker}</span>
            <span className="des-focal-name">{c.name}</span>
            <span className="des-focal-exchange">{c.exchange} · {c.currency}</span>
          </div>
          <div className="des-focal-meta">
            <span>SECTOR<b>{c.gicsSector}</b></span>
            <span>INDUSTRY<b>{c.gicsIndustry}</b></span>
            <span>HQ<b>{c.hqCity}</b></span>
            <span>EMPLOYEES<b>{c.employees?.toLocaleString() ?? '—'}</b></span>
            <span>FOUNDED<b>{c.founded}</b></span>
          </div>
        </div>

        <div className="des-focal-px">
          <span className="des-focal-px-main">{v.price != null ? `$${v.price.toFixed(2)}` : '—'}</span>
          <span className={`des-focal-px-delta ${deltaClass(v.change)}`}>
            {v.change != null
              ? `${v.change >= 0 ? '+' : ''}${v.change.toFixed(2)} (${signedPct(v.changePct, 2)})`
              : '—'}
          </span>
          <span className="des-focal-px-sub">MKT CAP {fmtUsdB(v.marketCapB)}</span>
        </div>
      </div>

      {/* -------------------------- two-column grid ----------------------- */}
      <div className="des-grid">
        {/* ----------------------- LEFT column --------------------------- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <section className="des-panel">
            <div className="des-panel-title">
              <span>1 · BUSINESS DESCRIPTION</span>
              <span className="des-panel-meta">Legal: {c.legalName}</span>
            </div>
            <div className="des-panel-body">
              <p className="des-description">{c.description}</p>
            </div>
          </section>

          <section className="des-panel">
            <div className="des-panel-title">
              <span>2 · REVENUE SEGMENTS</span>
              <span className="des-panel-meta">FY latest</span>
            </div>
            <div className="des-panel-body">
              <div className="des-seg-list">
                {segments.map((s) => (
                  <div className="des-seg-row" key={s.name}>
                    <span className="des-seg-name">{s.name}</span>
                    <div className="des-seg-track">
                      <div className="des-seg-fill" style={{ width: `${s.revenuePct}%` }} />
                    </div>
                    <span className="des-seg-pct">{s.revenuePct.toFixed(1)}%</span>
                    <div className="des-seg-desc">{s.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="des-panel">
            <div className="des-panel-title">
              <span>3 · KEY EXECUTIVES</span>
              <span className="des-panel-meta">{executives.length} listed</span>
            </div>
            <div className="des-panel-body" style={{ padding: 0 }}>
              <table className="des-exec-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Title</th>
                    <th className="des-align-right">Since</th>
                    <th className="des-align-right">Age</th>
                  </tr>
                </thead>
                <tbody>
                  {executives.map((e) => (
                    <tr key={e.name + e.title}>
                      <td className="des-exec-name">{e.name}</td>
                      <td className="des-exec-title">{e.title}</td>
                      <td className="des-align-right">{e.since}</td>
                      <td className="des-align-right">{e.ageYrs ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* ----------------------- RIGHT column -------------------------- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <section className="des-panel">
            <div className="des-panel-title">
              <span>4 · FINANCIAL HIGHLIGHTS</span>
              <span className="des-panel-meta">TTM</span>
            </div>
            <div className="des-panel-body">
              <div className="des-kv">
                <div><span className="k">Revenue</span><span className="v">{fmtUsdB(f.revenueTtmB)}</span></div>
                <div><span className="k">YoY growth</span><span className={`v ${f.revenueGrowthYoyPct >= 0 ? 'good' : 'bad'}`}>{signedPct(f.revenueGrowthYoyPct, 1)}</span></div>
                <div><span className="k">EBITDA</span><span className="v">{fmtUsdB(f.ebitdaTtmB)}</span></div>
                <div><span className="k">EBITDA margin</span><span className="v">{f.ebitdaMarginPct.toFixed(1)}%</span></div>
                <div className="des-kv-divider" />
                <div><span className="k">Gross margin</span><span className="v">{f.grossMarginPct.toFixed(1)}%</span></div>
                <div><span className="k">Operating margin</span><span className="v">{f.operatingMarginPct.toFixed(1)}%</span></div>
                <div><span className="k">Net income</span><span className="v">{fmtUsdB(f.netIncomeTtmB)}</span></div>
                <div><span className="k">Net margin</span><span className="v">{f.netMarginPct.toFixed(1)}%</span></div>
                <div className="des-kv-divider" />
                <div><span className="k">Free cash flow</span><span className="v">{fmtUsdB(f.fcfTtmB)}</span></div>
                <div><span className="k">Capex</span><span className="v dim">{fmtUsdB(f.capexTtmB)}</span></div>
                <div><span className="k">Cash &amp; ST inv.</span><span className="v">{fmtUsdB(f.cashAndStB)}</span></div>
                <div><span className="k">Total debt</span><span className="v">{fmtUsdB(f.totalDebtB)}</span></div>
                <div><span className="k">Net debt</span><span className={`v ${f.netDebtB < 0 ? 'good' : 'dim'}`}>{fmtUsdB(f.netDebtB)}</span></div>
                <div className="des-kv-divider" />
                <div><span className="k">ROE</span><span className="v">{f.roePct.toFixed(1)}%</span></div>
                <div><span className="k">ROA</span><span className="v">{f.roaPct.toFixed(1)}%</span></div>
                <div><span className="k">ROIC</span><span className="v">{f.roicPct.toFixed(1)}%</span></div>
              </div>
            </div>
          </section>

          <section className="des-panel">
            <div className="des-panel-title">
              <span>5 · VALUATION &amp; TRADING</span>
              <span className="des-panel-meta">EV {fmtUsdB(v.enterpriseValueB)}</span>
            </div>
            <div className="des-panel-body">
              <div className="des-kv">
                <div><span className="k">P/E (ttm)</span><span className="v">{v.pe.toFixed(1)}x</span></div>
                <div><span className="k">P/E (fwd)</span><span className="v">{v.peFwd.toFixed(1)}x</span></div>
                <div><span className="k">P/B</span><span className="v">{v.pbRatio.toFixed(1)}x</span></div>
                <div><span className="k">P/S</span><span className="v">{v.psRatio.toFixed(1)}x</span></div>
                <div><span className="k">EV/EBITDA</span><span className="v">{v.evEbitda.toFixed(1)}x</span></div>
                <div className="des-kv-divider" />
                <div><span className="k">Dividend yield</span><span className="v">{v.divYieldPct.toFixed(2)}%</span></div>
                <div><span className="k">Div / share</span><span className="v dim">${v.divPerShare.toFixed(2)}</span></div>
                <div><span className="k">Payout ratio</span><span className="v dim">{v.payoutRatioPct.toFixed(1)}%</span></div>
                <div className="des-kv-divider" />
                <div><span className="k">Shares out</span><span className="v">{fmtNum(v.sharesOutM, 0)}M</span></div>
                <div><span className="k">Float</span><span className="v dim">{fmtNum(v.floatM, 0)}M</span></div>
                <div><span className="k">Short interest</span><span className={`v ${v.shortInterestPct > 3 ? 'bad' : 'dim'}`}>{v.shortInterestPct.toFixed(2)}%</span></div>
                <div><span className="k">Beta</span><span className="v dim">{v.beta.toFixed(2)}</span></div>
                <div><span className="k">Avg vol (3m)</span><span className="v dim">{v.avgVol3moM.toFixed(1)}M</span></div>
              </div>

              <div className="des-range">
                <div className="des-range-track">
                  <div className="des-range-marker" style={{ left: `calc(${rangePos}% - 1px)` }} />
                </div>
                <div className="des-range-labels">
                  <span>52W LOW ${v.w52Low.toFixed(2)}</span>
                  <span>${v.price.toFixed(2)}</span>
                  <span>52W HIGH ${v.w52High.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* -------------------------- corporate info ------------------------ */}
      <section className="des-panel">
        <div className="des-panel-title">
          <span>6 · CORPORATE INFO</span>
          <span className="des-panel-meta">Identifiers · Contact · Listing</span>
        </div>
        <div className="des-panel-body">
          <div className="des-info-grid">
            <div className="des-info-group">
              <h4>Identifiers</h4>
              <div className="des-kv">
                <div><span className="k">ISIN</span><span className="v">{c.isin}</span></div>
                <div><span className="k">CUSIP</span><span className="v">{c.cusip}</span></div>
                <div><span className="k">SEDOL</span><span className="v">{c.sedol}</span></div>
                <div><span className="k">FIGI</span><span className="v">{c.figi}</span></div>
                <div><span className="k">BBGID</span><span className="v">{c.bbgid}</span></div>
                <div><span className="k">NAICS</span><span className="v dim">{c.naicsCode}</span></div>
              </div>
            </div>

            <div className="des-info-group">
              <h4>Headquarters &amp; Contact</h4>
              <div className="des-kv">
                <div><span className="k">HQ</span><span className="v">{c.hqCity}</span></div>
                <div><span className="k">Country</span><span className="v">{c.hqCountry}</span></div>
                <div><span className="k">Incorporation</span><span className="v dim">{c.incorporation}</span></div>
                <div><span className="k">Phone</span><span className="v dim">{c.phone}</span></div>
                <div><span className="k">Website</span><span className="v">{c.website}</span></div>
              </div>
            </div>

            <div className="des-info-group">
              <h4>Listing &amp; Fiscal</h4>
              <div className="des-kv">
                <div><span className="k">Exchange</span><span className="v">{c.exchange}</span></div>
                <div><span className="k">Reporting ccy</span><span className="v">{c.currency}</span></div>
                <div><span className="k">Listed</span><span className="v dim">{c.listingDate}</span></div>
                <div><span className="k">Fiscal YE</span><span className="v dim">{c.fiscalYearEnd}</span></div>
                <div><span className="k">GICS sector</span><span className="v">{c.gicsSector}</span></div>
                <div><span className="k">GICS industry</span><span className="v dim">{c.gicsIndustry}</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------- narrative: highlights / risks / catalysts ----- */}
      <section className="des-narrative">
        <div className="des-narrative-col highlights">
          <h4>HIGHLIGHTS</h4>
          <ul>
            {highlights.map((h) => <li key={h}>{h}</li>)}
          </ul>
        </div>
        <div className="des-narrative-col risks">
          <h4>RISKS</h4>
          <ul>
            {risks.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>
        <div className="des-narrative-col catalysts">
          <h4>CATALYSTS</h4>
          <ul>
            {catalysts.map((k) => <li key={k}>{k}</li>)}
          </ul>
        </div>
      </section>
    </div>
  );
}
