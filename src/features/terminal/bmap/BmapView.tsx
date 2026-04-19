/**
 * BmapView - Bloomberg-style global commodity asset map.
 *
 * Uses OpenStreetMap tiles via CartoDB's free "dark_matter" basemap (no API
 * key required) rendered by Leaflet.  Every asset class is drawn with a
 * custom `divIcon` so we avoid Leaflet's default marker-image bundling
 * problems.
 *
 * Layers:
 *   Oil Fields, Gas Fields, Pipelines, Shale Basins, Refineries, LNG
 *   Terminals, Mines, Ports, Vessels, Wind Farms, Storms.
 */

import { Fragment, useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import {
  CircleMarker,
  GeoJSON,
  MapContainer,
  Marker,
  Polygon,
  Polyline,
  Popup,
  TileLayer,
  ZoomControl,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './bmap.css';
import {
  generateBmapData,
  LAYER_META,
  LAYER_ORDER,
  type AssetLayerId,
  type BmapData,
  type PointAsset,
  type StormAsset,
  type VesselAsset,
  type LatLng,
} from './mockAssets';
import {
  generateWeiData,
  heatmapFill,
  heatmapStroke,
  HEATMAP_LEGEND,
  type IndexSnapshot,
  type WeiData,
} from './countryIndices';
import type { Feature, FeatureCollection, Geometry } from 'geojson';

/* -------------------------- custom marker builders ------------------------ */

function dotIcon(color: string, size = 10, border = '#0a0a00') {
  const s = size;
  return L.divIcon({
    className: 'bmap-dot',
    html: `<span style="background:${color};width:${s}px;height:${s}px;border:1.5px solid ${border};border-radius:50%;display:block;box-shadow:0 0 6px ${color}88;"></span>`,
    iconSize: [s + 4, s + 4],
    iconAnchor: [(s + 4) / 2, (s + 4) / 2],
  });
}

function squareIcon(color: string, size = 10) {
  return L.divIcon({
    className: 'bmap-square',
    html: `<span style="background:${color};width:${size}px;height:${size}px;border:1.5px solid #0a0a00;display:block;box-shadow:0 0 6px ${color}88;"></span>`,
    iconSize: [size + 4, size + 4],
    iconAnchor: [(size + 4) / 2, (size + 4) / 2],
  });
}

function triangleIcon(color: string, size = 12) {
  return L.divIcon({
    className: 'bmap-triangle',
    html: `<svg width="${size}" height="${size}" viewBox="0 0 12 12"><polygon points="6,1 11,11 1,11" fill="${color}" stroke="#0a0a00" stroke-width="1"/></svg>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function vesselIcon(color: string, heading: number, size = 14) {
  return L.divIcon({
    className: 'bmap-vessel',
    html: `<svg width="${size}" height="${size}" viewBox="0 0 12 12" style="transform:rotate(${heading}deg);transform-origin:center;">
      <polygon points="6,1 10,10 6,8 2,10" fill="${color}" stroke="#0a0a00" stroke-width="0.8"/>
    </svg>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function stormIcon(category: number, size = 26) {
  const color = category >= 4 ? '#dc2626' : category >= 2 ? '#f97316' : '#eab308';
  return L.divIcon({
    className: 'bmap-storm',
    html: `<div style="position:relative;width:${size}px;height:${size}px;">
      <svg width="${size}" height="${size}" viewBox="0 0 30 30" style="animation:bmap-spin 8s linear infinite;">
        <path d="M15 4 C23 4 26 11 22 15 C19 12 15 12 15 15 C15 12 11 12 8 15 C4 11 7 4 15 4 Z" fill="${color}cc" stroke="${color}" stroke-width="1"/>
        <path d="M15 26 C7 26 4 19 8 15 C11 18 15 18 15 15 C15 18 19 18 22 15 C26 19 23 26 15 26 Z" fill="${color}cc" stroke="${color}" stroke-width="1"/>
        <circle cx="15" cy="15" r="2" fill="#fff"/>
      </svg>
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/* --------------------------- popup helper elements ------------------------ */

function PopupShell({ title, sub, rows }: { title: string; sub?: string; rows: Array<{ label: string; value: string; tone?: 'good' | 'bad' | 'warn' | 'neutral' }> }) {
  return (
    <div className="bmap-popup">
      <div className="bmap-popup-header">
        <span className="bmap-popup-title">{title}</span>
        {sub && <span className="bmap-popup-sub">{sub}</span>}
      </div>
      <div className="bmap-popup-body">
        {rows.map((r, i) => (
          <div key={i} className="bmap-popup-row">
            <span className="bmap-popup-label">{r.label}</span>
            <span className={`bmap-popup-value bmap-tone-${r.tone ?? 'neutral'}`}>{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PointPopup({ asset, code }: { asset: PointAsset; code: string }) {
  return (
    <PopupShell
      title={asset.name}
      sub={`${code} · ${asset.country}`}
      rows={asset.props.map((p) => ({ label: p.label, value: p.value, tone: p.tone }))}
    />
  );
}

function VesselPopup({ v }: { v: VesselAsset }) {
  return (
    <PopupShell
      title={v.name}
      sub={`${v.type} · ${v.flag}`}
      rows={[
        { label: 'DWT', value: `${v.dwt}k t` },
        { label: 'Cargo', value: v.cargo },
        { label: 'Speed', value: `${v.speedKts} kts` },
        { label: 'Heading', value: `${v.headingDeg}°` },
        { label: 'Destination', value: v.destination },
        { label: 'ETA', value: v.eta },
      ]}
    />
  );
}

function StormPopup({ s }: { s: StormAsset }) {
  const rating = s.category === 0 ? 'Tropical Storm' : `Category ${s.category}`;
  return (
    <PopupShell
      title={s.name}
      sub={rating}
      rows={[
        { label: 'Max winds', value: `${s.windMph} mph`, tone: s.category >= 3 ? 'bad' : 'warn' },
        { label: 'Track points', value: `${s.track.length}` },
      ]}
    />
  );
}

/* ------------------------------- side panel ------------------------------- */

interface SidePanelProps {
  layers: Record<AssetLayerId, boolean>;
  counts: Record<AssetLayerId, number>;
  onToggle: (id: AssetLayerId) => void;
  onAll: (on: boolean) => void;
  total: number;
  onRegen: () => void;
  showHeatmap: boolean;
  onToggleHeatmap: () => void;
  wei: WeiData;
}

function SidePanel({
  layers,
  counts,
  onToggle,
  onAll,
  total,
  onRegen,
  showHeatmap,
  onToggleHeatmap,
  wei,
}: SidePanelProps) {
  return (
    <aside className="bmap-sidebar">
      <div className="bmap-sidebar-header">
        <span className="bmap-sidebar-title">Layers</span>
        <div className="bmap-sidebar-actions">
          <button className="bmap-btn" onClick={() => onAll(true)}>ALL</button>
          <button className="bmap-btn" onClick={() => onAll(false)}>NONE</button>
        </div>
      </div>

      {/* Dedicated heatmap toggle — separate from the commodity layers to
          make its unique nature (choropleth over full country polygons)
          obvious to the user. */}
      <button
        onClick={onToggleHeatmap}
        className={`bmap-layer-row bmap-layer-heatmap ${showHeatmap ? 'on' : ''}`}
        title="Colour each country by its flagship index day-change."
      >
        <span
          className="bmap-swatch"
          style={{
            background: 'linear-gradient(90deg, #991b1b 0%, #ef4444 25%, #71717a 50%, #10b981 75%, #047857 100%)',
          }}
        />
        <span className="bmap-layer-label">Indices Heatmap</span>
        <span className="bmap-layer-count">{wei.snapshots.length}</span>
        <span className={`bmap-toggle ${showHeatmap ? 'on' : ''}`} />
      </button>

      <div className="bmap-layer-list">
        {LAYER_ORDER.map((id) => {
          const meta = LAYER_META[id];
          const on = layers[id];
          return (
            <button
              key={id}
              onClick={() => onToggle(id)}
              className={`bmap-layer-row ${on ? 'on' : ''}`}
            >
              <span className="bmap-swatch" style={{ background: meta.color }} />
              <span className="bmap-layer-label">{meta.label}</span>
              <span className="bmap-layer-count">{counts[id]}</span>
              <span className={`bmap-toggle ${on ? 'on' : ''}`} />
            </button>
          );
        })}
      </div>

      {/* Top global movers — only relevant when the heatmap is on, but we
          keep them mounted so the data shape stays consistent. */}
      {showHeatmap && (
        <div className="bmap-movers">
          <div className="bmap-movers-title">Top Movers</div>
          <div className="bmap-movers-cols">
            <div className="bmap-movers-col">
              <span className="bmap-movers-label">Gainers</span>
              {wei.topGainers.slice(0, 4).map((s) => (
                <div key={s.iso3} className="bmap-mover-row">
                  <span className="bmap-mover-ticker">{s.ticker}</span>
                  <span className="bmap-mover-country">{s.country}</span>
                  <span className="bmap-mover-pct bmap-pos">+{s.changePct.toFixed(2)}%</span>
                </div>
              ))}
            </div>
            <div className="bmap-movers-col">
              <span className="bmap-movers-label">Losers</span>
              {wei.topLosers.slice(0, 4).map((s) => (
                <div key={s.iso3} className="bmap-mover-row">
                  <span className="bmap-mover-ticker">{s.ticker}</span>
                  <span className="bmap-mover-country">{s.country}</span>
                  <span className="bmap-mover-pct bmap-neg">{s.changePct.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bmap-sidebar-footer">
        <div className="bmap-footer-row">
          <span>Assets on map</span>
          <span className="bmap-num">{total.toLocaleString()}</span>
        </div>
        <button className="bmap-btn-wide" onClick={onRegen}>REFRESH DATA</button>
        <div className="bmap-tip">
          Tip: click any marker for details. Zoom with mouse wheel &middot; drag to pan.
        </div>
      </div>
    </aside>
  );
}

/* ----------------------- country heatmap (choropleth) --------------------- */

// CDN-hosted, well-maintained world-country GeoJSON keyed by ISO-3 country
// code.  Cached in module scope so re-mounts don't re-fetch.
const WORLD_GEOJSON_URL =
  'https://cdn.jsdelivr.net/gh/johan/world.geo.json@master/countries.geo.json';

type WorldFeature = Feature<Geometry, { name?: string }>;
type WorldGeo = FeatureCollection<Geometry, { name?: string }>;

let worldGeoCache: WorldGeo | null = null;
let worldGeoPromise: Promise<WorldGeo> | null = null;

function loadWorldGeoJSON(): Promise<WorldGeo> {
  if (worldGeoCache) return Promise.resolve(worldGeoCache);
  if (worldGeoPromise) return worldGeoPromise;
  worldGeoPromise = fetch(WORLD_GEOJSON_URL)
    .then((r) => {
      if (!r.ok) throw new Error(`Failed to load world GeoJSON (${r.status})`);
      return r.json() as Promise<WorldGeo>;
    })
    .then((geo) => {
      worldGeoCache = geo;
      return geo;
    })
    .catch((e) => {
      worldGeoPromise = null;
      throw e;
    });
  return worldGeoPromise;
}

/* ---------------------------------- view ---------------------------------- */

const DEFAULT_LAYERS: Record<AssetLayerId, boolean> = {
  oilFields: true,
  gasFields: true,
  refineries: true,
  lng: true,
  mines: true,
  pipelines: true,
  shaleBasins: true,
  ports: false,
  vessels: true,
  windFarms: false,
  storms: true,
};

export default function BmapView() {
  const [seed, setSeed] = useState(0);
  const [layers, setLayers] = useState<Record<AssetLayerId, boolean>>(DEFAULT_LAYERS);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [worldGeo, setWorldGeo] = useState<WorldGeo | null>(worldGeoCache);
  const [geoError, setGeoError] = useState<string | null>(null);

  const data: BmapData = useMemo(() => generateBmapData(`BMAP-${seed}`), [seed]);
  const wei: WeiData = useMemo(() => generateWeiData({ seedSalt: seed }), [seed]);

  // ISO-3 → snapshot lookup for the GeoJSON style callback.
  const bySeed = useMemo(() => {
    const m = new Map<string, IndexSnapshot>();
    wei.snapshots.forEach((s) => m.set(s.iso3, s));
    return m;
  }, [wei]);

  // Load the world GeoJSON once (and only if the heatmap is ever requested).
  useEffect(() => {
    if (!showHeatmap || worldGeo) return;
    let cancelled = false;
    loadWorldGeoJSON()
      .then((geo) => { if (!cancelled) setWorldGeo(geo); })
      .catch((e) => { if (!cancelled) setGeoError(String(e.message ?? e)); });
    return () => { cancelled = true; };
  }, [showHeatmap, worldGeo]);

  const counts = useMemo<Record<AssetLayerId, number>>(
    () => ({
      oilFields: data.oilFields.length,
      gasFields: data.gasFields.length,
      refineries: data.refineries.length,
      lng: data.lng.length,
      mines: data.mines.length,
      pipelines: data.pipelines.length,
      shaleBasins: data.shaleBasins.length,
      ports: data.ports.length,
      vessels: data.vessels.length,
      windFarms: data.windFarms.length,
      storms: data.storms.length,
    }),
    [data],
  );

  const total = useMemo(
    () => LAYER_ORDER.reduce((acc, id) => (layers[id] ? acc + counts[id] : acc), 0),
    [layers, counts],
  );

  const toggle = (id: AssetLayerId) =>
    setLayers((prev) => ({ ...prev, [id]: !prev[id] }));
  const setAll = (on: boolean) =>
    setLayers(
      LAYER_ORDER.reduce(
        (acc, id) => ({ ...acc, [id]: on }),
        {} as Record<AssetLayerId, boolean>,
      ),
    );

  return (
    <div className="bmap-root">
      <SidePanel
        layers={layers}
        counts={counts}
        onToggle={toggle}
        onAll={setAll}
        total={total}
        onRegen={() => setSeed((s) => s + 1)}
        showHeatmap={showHeatmap}
        onToggleHeatmap={() => setShowHeatmap((v) => !v)}
        wei={wei}
      />

      <div className="bmap-mapwrap">
        <MapContainer
          center={[25, 20]}
          zoom={3}
          minZoom={2}
          maxZoom={10}
          worldCopyJump
          scrollWheelZoom
          zoomControl={false}
          className="bmap-map"
          style={{ background: '#04060a' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CartoDB</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
          />
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            pane="shadowPane"
            opacity={0.9}
          />
          <ZoomControl position="bottomright" />

          {/* Country Indices Heatmap — choropleth sitting directly on top of
              the dark tile basemap so the fill colours read cleanly.  Each
              feature is joined on its ISO-3 id. */}
          {showHeatmap && worldGeo && (
            <GeoJSON
              key={`heatmap-${seed}`}
              data={worldGeo}
              style={(feature) => {
                const f = feature as WorldFeature | undefined;
                const iso3 = (f?.id ?? '') as string;
                const snap = bySeed.get(iso3);
                const chg = snap?.changePct;
                return {
                  color: heatmapStroke(chg),
                  weight: 0.6,
                  opacity: snap ? 0.6 : 0.25,
                  fillColor: heatmapFill(chg, 1),
                  fillOpacity: snap ? 0.55 : 0.12,
                };
              }}
              onEachFeature={(feature, layer) => {
                const f = feature as WorldFeature;
                const iso3 = (f.id ?? '') as string;
                const snap = bySeed.get(iso3);
                const countryName = snap?.country ?? f.properties?.name ?? iso3;
                if (!snap) {
                  layer.bindTooltip(
                    `<div class="bmap-heat-tip">
                       <div class="bmap-heat-tip-country">${countryName}</div>
                       <div class="bmap-heat-tip-note">No flagship index tracked</div>
                     </div>`,
                    { sticky: true, direction: 'top', className: 'bmap-heat-tooltip' },
                  );
                  return;
                }
                const sign = snap.changePct >= 0 ? '+' : '';
                const tone = snap.changePct >= 0 ? 'bmap-pos' : 'bmap-neg';
                layer.bindTooltip(
                  `<div class="bmap-heat-tip">
                     <div class="bmap-heat-tip-country">${snap.country}</div>
                     <div class="bmap-heat-tip-index">${snap.index} <span class="bmap-heat-tip-tkr">${snap.ticker}</span></div>
                     <div class="bmap-heat-tip-row"><span>Last</span><b>${snap.price.toLocaleString()} ${snap.currency}</b></div>
                     <div class="bmap-heat-tip-row"><span>Day</span><b class="${tone}">${sign}${snap.changePct.toFixed(2)}%</b></div>
                     <div class="bmap-heat-tip-row"><span>YTD</span><b class="${snap.ytdPct >= 0 ? 'bmap-pos' : 'bmap-neg'}">${snap.ytdPct >= 0 ? '+' : ''}${snap.ytdPct.toFixed(1)}%</b></div>
                   </div>`,
                  { sticky: true, direction: 'top', className: 'bmap-heat-tooltip' },
                );
                layer.bindPopup(
                  `<div class="bmap-popup">
                     <div class="bmap-popup-header">
                       <span class="bmap-popup-title">${snap.index}</span>
                       <span class="bmap-popup-sub">${snap.ticker} · ${snap.country}</span>
                     </div>
                     <div class="bmap-popup-body">
                       <div class="bmap-popup-row"><span class="bmap-popup-label">Last</span><span class="bmap-popup-value">${snap.price.toLocaleString()} ${snap.currency}</span></div>
                       <div class="bmap-popup-row"><span class="bmap-popup-label">Day</span><span class="bmap-popup-value bmap-tone-${snap.changePct >= 0 ? 'good' : 'bad'}">${sign}${snap.changePct.toFixed(2)}%</span></div>
                       <div class="bmap-popup-row"><span class="bmap-popup-label">YTD</span><span class="bmap-popup-value bmap-tone-${snap.ytdPct >= 0 ? 'good' : 'bad'}">${snap.ytdPct >= 0 ? '+' : ''}${snap.ytdPct.toFixed(1)}%</span></div>
                       <div class="bmap-popup-row"><span class="bmap-popup-label">Prev close</span><span class="bmap-popup-value">${snap.prevClose.toLocaleString()}</span></div>
                     </div>
                   </div>`,
                );
              }}
            />
          )}

          {/* Shale Basins — polygons underneath everything */}
          {layers.shaleBasins &&
            data.shaleBasins.map((b) => (
              <Polygon
                key={b.id}
                positions={b.ring as LatLng[]}
                pathOptions={{
                  color: LAYER_META.shaleBasins.color,
                  weight: 1,
                  opacity: 0.75,
                  fillColor: LAYER_META.shaleBasins.color,
                  fillOpacity: 0.18,
                  dashArray: '4 3',
                }}
              >
                <Popup>
                  <PopupShell
                    title={b.name}
                    sub={`Shale Basin · ${b.country}`}
                    rows={[
                      { label: 'Resource', value: b.resource.toUpperCase() },
                      { label: 'Status', value: 'Active', tone: 'good' },
                    ]}
                  />
                </Popup>
              </Polygon>
            ))}

          {/* Pipelines */}
          {layers.pipelines &&
            data.pipelines.map((p) => (
              <Polyline
                key={p.id}
                positions={p.path as LatLng[]}
                pathOptions={{
                  color: p.kind === 'oil' ? '#ef4444' : '#f59e0b',
                  weight: 1.8,
                  opacity: 0.9,
                  dashArray: p.kind === 'gas' ? '6 4' : undefined,
                }}
              >
                <Popup>
                  <PopupShell
                    title={p.name}
                    sub={`${p.kind === 'oil' ? 'Crude Oil' : 'Natural Gas'} Pipeline`}
                    rows={[
                      { label: 'Operator', value: p.operator },
                      p.capacityMbd
                        ? { label: 'Capacity', value: `${p.capacityMbd} mbd` }
                        : { label: 'Capacity', value: `${p.capacityBcfd} Bcf/d` },
                      { label: 'Status', value: 'Operational', tone: 'good' },
                    ]}
                  />
                </Popup>
              </Polyline>
            ))}

          {/* Oil Fields */}
          {layers.oilFields &&
            data.oilFields.map((f) => (
              <Marker key={f.id} position={f.position} icon={dotIcon(LAYER_META.oilFields.color, 12)}>
                <Popup>
                  <PointPopup asset={f} code={LAYER_META.oilFields.code} />
                </Popup>
              </Marker>
            ))}

          {/* Gas Fields */}
          {layers.gasFields &&
            data.gasFields.map((f) => (
              <Marker key={f.id} position={f.position} icon={dotIcon(LAYER_META.gasFields.color, 12)}>
                <Popup>
                  <PointPopup asset={f} code={LAYER_META.gasFields.code} />
                </Popup>
              </Marker>
            ))}

          {/* Refineries - triangle */}
          {layers.refineries &&
            data.refineries.map((r) => (
              <Marker key={r.id} position={r.position} icon={triangleIcon(LAYER_META.refineries.color, 14)}>
                <Popup>
                  <PointPopup asset={r} code={LAYER_META.refineries.code} />
                </Popup>
              </Marker>
            ))}

          {/* LNG - square */}
          {layers.lng &&
            data.lng.map((t) => (
              <Marker key={t.id} position={t.position} icon={squareIcon(LAYER_META.lng.color, 10)}>
                <Popup>
                  <PointPopup asset={t} code={LAYER_META.lng.code} />
                </Popup>
              </Marker>
            ))}

          {/* Mines - diamond-ish (square rotated via CSS) */}
          {layers.mines &&
            data.mines.map((m) => (
              <Marker
                key={m.id}
                position={m.position}
                icon={L.divIcon({
                  className: 'bmap-diamond',
                  html: `<span style="background:${LAYER_META.mines.color};width:10px;height:10px;border:1.5px solid #0a0a00;display:block;transform:rotate(45deg);box-shadow:0 0 6px ${LAYER_META.mines.color}88;"></span>`,
                  iconSize: [14, 14],
                  iconAnchor: [7, 7],
                })}
              >
                <Popup>
                  <PointPopup asset={m} code={LAYER_META.mines.code} />
                </Popup>
              </Marker>
            ))}

          {/* Ports */}
          {layers.ports &&
            data.ports.map((p) => (
              <Marker key={p.id} position={p.position} icon={squareIcon(LAYER_META.ports.color, 9)}>
                <Popup>
                  <PointPopup asset={p} code={LAYER_META.ports.code} />
                </Popup>
              </Marker>
            ))}

          {/* Wind Farms — pulsing green circle */}
          {layers.windFarms &&
            data.windFarms.map((w) => (
              <Marker key={w.id} position={w.position} icon={dotIcon(LAYER_META.windFarms.color, 10)}>
                <Popup>
                  <PointPopup asset={w} code={LAYER_META.windFarms.code} />
                </Popup>
              </Marker>
            ))}

          {/* Vessels — tiny arrows */}
          {layers.vessels &&
            data.vessels.map((v) => (
              <Marker
                key={v.id}
                position={v.position}
                icon={vesselIcon(LAYER_META.vessels.color, v.headingDeg, 14)}
              >
                <Popup>
                  <VesselPopup v={v} />
                </Popup>
              </Marker>
            ))}

          {/* Storms — rotating spiral + track line + surrounding cone */}
          {layers.storms &&
            data.storms.map((s) => (
              <Fragment key={s.id}>
                <Polyline
                  positions={s.track as LatLng[]}
                  pathOptions={{
                    color: LAYER_META.storms.color,
                    weight: 1.5,
                    opacity: 0.6,
                    dashArray: '3 3',
                  }}
                />
                <CircleMarker
                  center={s.position}
                  radius={20}
                  pathOptions={{
                    color: LAYER_META.storms.color,
                    weight: 1,
                    opacity: 0.4,
                    fillColor: LAYER_META.storms.color,
                    fillOpacity: 0.08,
                  }}
                />
                <Marker position={s.position} icon={stormIcon(s.category, 28)}>
                  <Popup>
                    <StormPopup s={s} />
                  </Popup>
                </Marker>
              </Fragment>
            ))}
        </MapContainer>

        {/* Top overlay - summary ticker */}
        <div className="bmap-overlay-top">
          <span className="bmap-overlay-chip" style={{ color: '#ff9f1a' }}>BMAP &lt;GO&gt;</span>
          <span className="bmap-overlay-chip">
            BRENT{' '}
            <span className="bmap-pos">$82.47 +1.2%</span>
          </span>
          <span className="bmap-overlay-chip">
            WTI{' '}
            <span className="bmap-pos">$78.03 +0.9%</span>
          </span>
          <span className="bmap-overlay-chip">
            HENRY HUB{' '}
            <span className="bmap-neg">$2.38 -2.1%</span>
          </span>
          <span className="bmap-overlay-chip">
            DUTCH TTF{' '}
            <span className="bmap-pos">€42.10 +3.4%</span>
          </span>
          <span className="bmap-overlay-chip">
            BDI{' '}
            <span className="bmap-neg">1,842 -0.6%</span>
          </span>
        </div>

        {/* Indices tape — only visible while the heatmap is active. */}
        {showHeatmap && (
          <div className="bmap-indices-tape">
            <span className="bmap-overlay-chip" style={{ color: '#ff9f1a' }}>WEI</span>
            {wei.topGainers.map((s) => (
              <span key={`g-${s.iso3}`} className="bmap-overlay-chip">
                {s.ticker}
                <span className="bmap-pos">+{s.changePct.toFixed(2)}%</span>
              </span>
            ))}
            <span className="bmap-overlay-chip bmap-tape-sep">|</span>
            {wei.topLosers.map((s) => (
              <span key={`l-${s.iso3}`} className="bmap-overlay-chip">
                {s.ticker}
                <span className="bmap-neg">{s.changePct.toFixed(2)}%</span>
              </span>
            ))}
          </div>
        )}

        {/* Loading / error overlay for the choropleth fetch. */}
        {showHeatmap && !worldGeo && !geoError && (
          <div className="bmap-heat-status">Loading country boundaries…</div>
        )}
        {showHeatmap && geoError && (
          <div className="bmap-heat-status bmap-heat-error">
            Heatmap unavailable: {geoError}
          </div>
        )}

        {/* Bottom overlay - legend */}
        <div className="bmap-overlay-bottom">
          {showHeatmap && (
            <div className="bmap-heat-legend">
              <span className="bmap-heat-legend-title">Index Day Change</span>
              <div className="bmap-heat-legend-scale">
                {HEATMAP_LEGEND.map((step) => (
                  <span key={step.label} className="bmap-heat-legend-step">
                    <span className="bmap-heat-legend-swatch" style={{ background: step.color }} />
                    <span>{step.label}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
          {LAYER_ORDER.filter((id) => layers[id]).map((id) => {
            const m = LAYER_META[id];
            return (
              <span key={id} className="bmap-legend-item">
                <span className="bmap-swatch" style={{ background: m.color }} />
                {m.label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
