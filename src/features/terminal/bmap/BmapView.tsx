/**
 * BmapView - Bloomberg-style global commodity asset map.
 *
 * Uses Mapbox GL JS via react-map-gl with the "dark-v11" style.  All asset
 * classes are rendered as GeoJSON source + layers for GPU-accelerated rendering.
 *
 * Advanced features:
 *   - 3D globe projection with atmosphere / fog
 *   - Fly-to animations when focusing on a layer
 *   - Vessel clustering at low zoom
 *   - Pitch/bearing navigation controls
 *   - Premium dark-mode popups matching the Bloomberg aesthetic
 *
 * Layers:
 *   Oil Fields, Gas Fields, Pipelines, Shale Basins, Refineries, LNG
 *   Terminals, Mines, Ports, Vessels, Wind Farms, Storms.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// Aliased to `MapboxMap` because the default name `Map` shadows the
// global `Map` constructor — `new Map<K, V>()` below would otherwise
// resolve to the React component and fail to compile.
import MapboxMap, {
  Source,
  Layer,
  Popup,
  NavigationControl,
  ScaleControl,
  type MapRef,
  type ViewStateChangeEvent,
  type MapMouseEvent as MapLayerMouseEvent,
} from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import './bmap.css';
import {
  generateBmapData,
  LAYER_META,
  LAYER_ORDER,
  type AssetLayerId,
  type BmapData,
  type PointAsset,
  type VesselAsset,
  type StormAsset,
  type LineAsset,
  type BasinAsset,
} from './mockAssets';
import {
  generateWeiData,
  heatmapFill,
  HEATMAP_LEGEND,
  type IndexSnapshot,
  type WeiData,
} from './countryIndices';
import { LIVE_LAYERS } from './layers/registry';
import { useLiveLayers, type LiveLayerSnapshot } from './layers/useLiveLayers';
import type { Feature, FeatureCollection, Geometry, Point, LineString, Polygon } from 'geojson';

/* -------------------------------- constants ------------------------------- */

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;
const MAPBOX_STYLE = 'mapbox://styles/mapbox/dark-v11';

const WORLD_GEOJSON_URL =
  'https://cdn.jsdelivr.net/gh/johan/world.geo.json@master/countries.geo.json';

/* --------------------------------- types ---------------------------------- */

interface PopupInfo {
  lng: number;
  lat: number;
  html: string;
}

type WorldFeature = Feature<Geometry, { name?: string }>;
type WorldGeo = FeatureCollection<Geometry, { name?: string }>;

/* ------------------------------- data cache ------------------------------- */

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

/* ----------------------- GeoJSON data builders ---------------------------- */

/** Flip [lat, lng] (Leaflet convention in mockAssets) → [lng, lat] (GeoJSON). */
function ll(position: [number, number]): [number, number] {
  return [position[1], position[0]];
}

function buildPointGeoJSON(
  items: PointAsset[],
  layerId: string,
): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: items.map((item) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: ll(item.position) },
      properties: {
        id: item.id,
        name: item.name,
        country: item.country,
        layerId,
        propsJson: JSON.stringify(item.props),
      },
    })),
  };
}

function buildVesselGeoJSON(vessels: VesselAsset[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: vessels.map((v) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: ll(v.position) },
      properties: {
        id: v.id,
        name: v.name,
        flag: v.flag,
        type: v.type,
        dwt: v.dwt,
        cargo: v.cargo,
        destination: v.destination,
        eta: v.eta,
        speedKts: v.speedKts,
        headingDeg: v.headingDeg,
        layerId: 'vessels',
      },
    })),
  };
}

function buildStormGeoJSON(storms: StormAsset[]): {
  points: FeatureCollection<Point>;
  tracks: FeatureCollection<LineString>;
} {
  const points: FeatureCollection<Point> = {
    type: 'FeatureCollection',
    features: storms.map((s) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: ll(s.position) },
      properties: {
        id: s.id,
        name: s.name,
        category: s.category,
        windMph: s.windMph,
        layerId: 'storms',
      },
    })),
  };
  const tracks: FeatureCollection<LineString> = {
    type: 'FeatureCollection',
    features: storms.map((s) => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: s.track.map(ll),
      },
      properties: { id: s.id, name: s.name },
    })),
  };
  return { points, tracks };
}

function buildPipelineGeoJSON(pipes: LineAsset[]): FeatureCollection<LineString> {
  return {
    type: 'FeatureCollection',
    features: pipes.map((p) => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: p.path.map(ll) },
      properties: {
        id: p.id,
        name: p.name,
        kind: p.kind,
        operator: p.operator,
        capacityMbd: p.capacityMbd ?? null,
        capacityBcfd: p.capacityBcfd ?? null,
        layerId: 'pipelines',
      },
    })),
  };
}

function buildBasinGeoJSON(basins: BasinAsset[]): FeatureCollection<Polygon> {
  return {
    type: 'FeatureCollection',
    features: basins.map((b) => ({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[...b.ring.map(ll), ll(b.ring[0])]],
      },
      properties: {
        id: b.id,
        name: b.name,
        country: b.country,
        resource: b.resource,
        layerId: 'shaleBasins',
      },
    })),
  };
}

/**
 * Build heatmap choropleth GeoJSON — colour each country by its flagship
 * index day-change, joining on ISO-3 feature IDs.
 */
function buildHeatmapGeoJSON(
  worldGeo: WorldGeo,
  lookup: Map<string, IndexSnapshot>,
): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: worldGeo.features.map((f) => {
      const iso3 = (f.id ?? '') as string;
      const snap = lookup.get(iso3);
      const changePct = snap?.changePct ?? null;
      return {
        ...f,
        properties: {
          ...f.properties,
          iso3,
          changePct,
          fillColor: heatmapFill(changePct, 1),
          hasData: !!snap,
          // Data for tooltip
          country: snap?.country ?? f.properties?.name ?? iso3,
          index: snap?.index ?? '',
          ticker: snap?.ticker ?? '',
          price: snap?.price ?? 0,
          currency: snap?.currency ?? '',
          ytdPct: snap?.ytdPct ?? 0,
          prevClose: snap?.prevClose ?? 0,
        },
      };
    }),
  };
}

/* ----------------------------- popup builders ----------------------------- */

function buildPointPopupHtml(props: Record<string, unknown>): string {
  const name = props.name as string;
  const country = props.country as string;
  const layerId = props.layerId as string;
  const code = LAYER_META[layerId as AssetLayerId]?.code ?? '';
  const parsed = JSON.parse(props.propsJson as string) as Array<{
    label: string;
    value: string;
    tone?: string;
  }>;
  const rows = parsed
    .map(
      (p) =>
        `<div class="bmap-popup-row"><span class="bmap-popup-label">${p.label}</span><span class="bmap-popup-value bmap-tone-${p.tone ?? 'neutral'}">${p.value}</span></div>`,
    )
    .join('');
  return `<div class="bmap-popup">
    <div class="bmap-popup-header">
      <span class="bmap-popup-title">${name}</span>
      <span class="bmap-popup-sub">${code} · ${country}</span>
    </div>
    <div class="bmap-popup-body">${rows}</div>
  </div>`;
}

function buildVesselPopupHtml(props: Record<string, unknown>): string {
  const rows = [
    { label: 'DWT', value: `${props.dwt}k t` },
    { label: 'Cargo', value: props.cargo as string },
    { label: 'Speed', value: `${props.speedKts} kts` },
    { label: 'Heading', value: `${props.headingDeg}°` },
    { label: 'Destination', value: props.destination as string },
    { label: 'ETA', value: props.eta as string },
  ];
  return `<div class="bmap-popup">
    <div class="bmap-popup-header">
      <span class="bmap-popup-title">${props.name}</span>
      <span class="bmap-popup-sub">${props.type} · ${props.flag}</span>
    </div>
    <div class="bmap-popup-body">${rows.map((r) => `<div class="bmap-popup-row"><span class="bmap-popup-label">${r.label}</span><span class="bmap-popup-value">${r.value}</span></div>`).join('')}</div>
  </div>`;
}

function buildStormPopupHtml(props: Record<string, unknown>): string {
  const category = props.category as number;
  const rating = category === 0 ? 'Tropical Storm' : `Category ${category}`;
  const tone = category >= 3 ? 'bad' : 'warn';
  return `<div class="bmap-popup">
    <div class="bmap-popup-header">
      <span class="bmap-popup-title">${props.name}</span>
      <span class="bmap-popup-sub">${rating}</span>
    </div>
    <div class="bmap-popup-body">
      <div class="bmap-popup-row"><span class="bmap-popup-label">Max winds</span><span class="bmap-popup-value bmap-tone-${tone}">${props.windMph} mph</span></div>
    </div>
  </div>`;
}

function buildPipelinePopupHtml(props: Record<string, unknown>): string {
  const kind = props.kind as string;
  const cap =
    kind === 'oil'
      ? `${props.capacityMbd} mbd`
      : `${props.capacityBcfd} Bcf/d`;
  return `<div class="bmap-popup">
    <div class="bmap-popup-header">
      <span class="bmap-popup-title">${props.name}</span>
      <span class="bmap-popup-sub">${kind === 'oil' ? 'Crude Oil' : 'Natural Gas'} Pipeline</span>
    </div>
    <div class="bmap-popup-body">
      <div class="bmap-popup-row"><span class="bmap-popup-label">Operator</span><span class="bmap-popup-value">${props.operator}</span></div>
      <div class="bmap-popup-row"><span class="bmap-popup-label">Capacity</span><span class="bmap-popup-value">${cap}</span></div>
      <div class="bmap-popup-row"><span class="bmap-popup-label">Status</span><span class="bmap-popup-value bmap-tone-good">Operational</span></div>
    </div>
  </div>`;
}

function buildBasinPopupHtml(props: Record<string, unknown>): string {
  return `<div class="bmap-popup">
    <div class="bmap-popup-header">
      <span class="bmap-popup-title">${props.name}</span>
      <span class="bmap-popup-sub">Shale Basin · ${props.country}</span>
    </div>
    <div class="bmap-popup-body">
      <div class="bmap-popup-row"><span class="bmap-popup-label">Resource</span><span class="bmap-popup-value">${(props.resource as string).toUpperCase()}</span></div>
      <div class="bmap-popup-row"><span class="bmap-popup-label">Status</span><span class="bmap-popup-value bmap-tone-good">Active</span></div>
    </div>
  </div>`;
}

function buildHeatmapPopupHtml(props: Record<string, unknown>): string {
  const hasData = props.hasData as boolean;
  const country = props.country as string;
  if (!hasData) {
    return `<div class="bmap-popup">
      <div class="bmap-popup-header">
        <span class="bmap-popup-title">${country}</span>
        <span class="bmap-popup-sub">No flagship index tracked</span>
      </div>
    </div>`;
  }
  const changePct = props.changePct as number;
  const sign = changePct >= 0 ? '+' : '';
  const tone = changePct >= 0 ? 'good' : 'bad';
  const ytdPct = props.ytdPct as number;
  return `<div class="bmap-popup">
    <div class="bmap-popup-header">
      <span class="bmap-popup-title">${props.index}</span>
      <span class="bmap-popup-sub">${props.ticker} · ${country}</span>
    </div>
    <div class="bmap-popup-body">
      <div class="bmap-popup-row"><span class="bmap-popup-label">Last</span><span class="bmap-popup-value">${Number(props.price).toLocaleString()} ${props.currency}</span></div>
      <div class="bmap-popup-row"><span class="bmap-popup-label">Day</span><span class="bmap-popup-value bmap-tone-${tone}">${sign}${changePct.toFixed(2)}%</span></div>
      <div class="bmap-popup-row"><span class="bmap-popup-label">YTD</span><span class="bmap-popup-value bmap-tone-${ytdPct >= 0 ? 'good' : 'bad'}">${ytdPct >= 0 ? '+' : ''}${ytdPct.toFixed(1)}%</span></div>
      <div class="bmap-popup-row"><span class="bmap-popup-label">Prev close</span><span class="bmap-popup-value">${Number(props.prevClose).toLocaleString()}</span></div>
    </div>
  </div>`;
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
  isGlobe: boolean;
  onToggleGlobe: () => void;
  live: LiveLayerSnapshot;
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
  isGlobe,
  onToggleGlobe,
  live,
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

      {/* Globe / Flat toggle */}
      <button
        onClick={onToggleGlobe}
        className="bmap-layer-row bmap-layer-globe on"
        title={isGlobe ? 'Switch to flat projection' : 'Switch to 3D globe'}
      >
        <span className="bmap-swatch" style={{ background: '#6366f1' }} />
        <span className="bmap-layer-label">{isGlobe ? '🌍 Globe' : '🗺️ Flat'}</span>
        <span className="bmap-layer-count">3D</span>
        <span className={`bmap-toggle ${isGlobe ? 'on' : ''}`} />
      </button>

      {/* Heatmap toggle */}
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

      {/* Top global movers */}
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

      <div className="bmap-sidebar-section">
        <div className="bmap-sidebar-subhead">Live data</div>

        <button
          onClick={live.toggleVessels}
          className={`bmap-layer-row ${live.vesselsEnabled ? 'on' : ''}`}
          title="Live vessel positions from AISStream"
        >
          <span className="bmap-swatch" style={{ background: '#22d3ee' }} />
          <span className="bmap-layer-label">Vessels (AIS)</span>
          <span className="bmap-layer-count">
            {live.vessels?.features.length ?? 0}
          </span>
          <span className={`bmap-toggle ${live.vesselsEnabled ? 'on' : ''}`} />
        </button>

        {LIVE_LAYERS.map((layer) => {
          const status = live.status[layer.id];
          const dot =
            status === 'live' ? '●'
            : status === 'loading' ? '⟳'
            : status === 'error' ? '!'
            : '○';
          const dotColor =
            status === 'live' ? '#10b981'
            : status === 'loading' ? '#facc15'
            : status === 'error' ? '#ef4444'
            : '#52525b';
          const count = live.data[layer.id]?.features.length ?? 0;
          return (
            <button
              key={layer.id}
              onClick={() => live.toggle(layer.id)}
              className={`bmap-layer-row ${live.enabled[layer.id] ? 'on' : ''}`}
              title={layer.description}
            >
              <span className="bmap-swatch" style={{ background: layer.color }} />
              <span className="bmap-layer-label">{layer.label}</span>
              <span className="bmap-layer-count" style={{ color: dotColor }}>
                {dot} {count}
              </span>
              <span className={`bmap-toggle ${live.enabled[layer.id] ? 'on' : ''}`} />
            </button>
          );
        })}
      </div>

      <div className="bmap-sidebar-footer">
        <div className="bmap-footer-row">
          <span>Assets on map</span>
          <span className="bmap-num">{total.toLocaleString()}</span>
        </div>
        <button className="bmap-btn-wide" onClick={onRegen}>REFRESH DATA</button>
        <div className="bmap-tip">
          Tip: click any marker for details. Scroll to zoom · drag to pan · right-drag to tilt.
        </div>
      </div>
    </aside>
  );
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

/** Layer IDs that are interactive (clickable for popups). */
const INTERACTIVE_LAYERS = [
  'bmap-oil-circle',
  'bmap-gas-circle',
  'bmap-refinery-circle',
  'bmap-lng-circle',
  'bmap-mine-circle',
  'bmap-port-circle',
  'bmap-wind-circle',
  'bmap-vessel-circle',
  'bmap-storm-circle',
  'bmap-pipeline-line',
  'bmap-basin-fill',
  'bmap-heatmap-fill',
];

export default function BmapView() {
  const mapRef = useRef<MapRef>(null);
  const [seed, setSeed] = useState(0);
  const [layers, setLayers] = useState<Record<AssetLayerId, boolean>>(DEFAULT_LAYERS);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [isGlobe, setIsGlobe] = useState(true);
  const [popupInfo, setPopupInfo] = useState<PopupInfo | null>(null);
  const [worldGeo, setWorldGeo] = useState<WorldGeo | null>(worldGeoCache);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [cursor, setCursor] = useState('grab');
  const live = useLiveLayers();

  const [viewState, setViewState] = useState({
    longitude: 20,
    latitude: 25,
    zoom: 2.2,
    pitch: 25,
    bearing: 0,
  });

  const data: BmapData = useMemo(() => generateBmapData(`BMAP-${seed}`), [seed]);
  const wei: WeiData = useMemo(() => generateWeiData({ seedSalt: seed }), [seed]);

  const bySeed = useMemo(() => {
    const m = new Map<string, IndexSnapshot>();
    wei.snapshots.forEach((s) => m.set(s.iso3, s));
    return m;
  }, [wei]);

  // Load world GeoJSON for the heatmap choropleth.
  useEffect(() => {
    if (!showHeatmap || worldGeo) return;
    let cancelled = false;
    loadWorldGeoJSON()
      .then((geo) => { if (!cancelled) setWorldGeo(geo); })
      .catch((e) => { if (!cancelled) setGeoError(String(e.message ?? e)); });
    return () => { cancelled = true; };
  }, [showHeatmap, worldGeo]);

  /* -------- build GeoJSON sources -------- */

  const oilGeo = useMemo(() => buildPointGeoJSON(data.oilFields, 'oilFields'), [data]);
  const gasGeo = useMemo(() => buildPointGeoJSON(data.gasFields, 'gasFields'), [data]);
  const refGeo = useMemo(() => buildPointGeoJSON(data.refineries, 'refineries'), [data]);
  const lngGeo = useMemo(() => buildPointGeoJSON(data.lng, 'lng'), [data]);
  const mineGeo = useMemo(() => buildPointGeoJSON(data.mines, 'mines'), [data]);
  const portGeo = useMemo(() => buildPointGeoJSON(data.ports, 'ports'), [data]);
  const windGeo = useMemo(() => buildPointGeoJSON(data.windFarms, 'windFarms'), [data]);
  const vesselGeo = useMemo(() => buildVesselGeoJSON(data.vessels), [data]);
  const stormData = useMemo(() => buildStormGeoJSON(data.storms), [data]);
  const pipeGeo = useMemo(() => buildPipelineGeoJSON(data.pipelines), [data]);
  const basinGeo = useMemo(() => buildBasinGeoJSON(data.shaleBasins), [data]);
  const heatmapGeo = useMemo(
    () => (worldGeo ? buildHeatmapGeoJSON(worldGeo, bySeed) : null),
    [worldGeo, bySeed],
  );

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

  /* -------- map interaction handlers -------- */

  const onMapClick = useCallback((e: MapLayerMouseEvent) => {
    const feature = e.features?.[0];
    if (!feature) {
      setPopupInfo(null);
      return;
    }

    const props = feature.properties ?? {};
    const layerId = feature.layer?.id ?? '';
    let html = '';

    if (layerId === 'bmap-heatmap-fill') {
      html = buildHeatmapPopupHtml(props);
    } else if (layerId === 'bmap-vessel-circle') {
      html = buildVesselPopupHtml(props);
    } else if (layerId === 'bmap-storm-circle') {
      html = buildStormPopupHtml(props);
    } else if (layerId === 'bmap-pipeline-line') {
      html = buildPipelinePopupHtml(props);
    } else if (layerId === 'bmap-basin-fill') {
      html = buildBasinPopupHtml(props);
    } else if (props.propsJson) {
      html = buildPointPopupHtml(props);
    }

    if (html) {
      setPopupInfo({ lng: e.lngLat.lng, lat: e.lngLat.lat, html });
    }
  }, []);

  const onMouseEnter = useCallback(() => setCursor('pointer'), []);
  const onMouseLeave = useCallback(() => setCursor('grab'), []);

  const onMapLoad = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    // Premium atmosphere / fog for globe mode
    map.setFog({
      color: 'rgb(10, 10, 20)',
      'high-color': 'rgb(20, 20, 40)',
      'horizon-blend': 0.08,
      'space-color': 'rgb(4, 6, 10)',
      'star-intensity': 0.6,
    });
  }, []);

  // Toggle globe/flat projection.
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !map.isStyleLoaded()) return;
    map.setProjection(isGlobe ? 'globe' : 'mercator');
  }, [isGlobe]);

  /* -------- Mapbox paint helpers -------- */

  /** A helper to map changePct to fill-color for heatmap choropleth. */
  const heatmapFillExpression: any = [
    'case',
    ['==', ['get', 'hasData'], false],
    'rgba(39,39,42,0.07)',
    ['>=', ['get', 'changePct'], 3],
    'rgba(5,122,85,0.55)',
    ['>=', ['get', 'changePct'], 1.5],
    'rgba(16,185,129,0.55)',
    ['>=', ['get', 'changePct'], 0.75],
    'rgba(52,211,153,0.5)',
    ['>=', ['get', 'changePct'], 0.25],
    'rgba(110,231,183,0.4)',
    ['>=', ['get', 'changePct'], -0.25],
    'rgba(113,113,122,0.3)',
    ['>=', ['get', 'changePct'], -0.75],
    'rgba(252,165,165,0.4)',
    ['>=', ['get', 'changePct'], -1.5],
    'rgba(239,68,68,0.5)',
    ['>=', ['get', 'changePct'], -3],
    'rgba(220,38,38,0.55)',
    'rgba(153,27,27,0.6)',
  ];

  const heatmapLineExpression: any = [
    'case',
    ['==', ['get', 'hasData'], false],
    '#27272a',
    ['>=', ['get', 'changePct'], 0],
    '#10b981',
    '#ef4444',
  ];

  /* ============================== RENDER ================================== */

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
        isGlobe={isGlobe}
        onToggleGlobe={() => setIsGlobe((g) => !g)}
        live={live}
      />

      <div className="bmap-mapwrap">
        <MapboxMap
          ref={mapRef}
          {...viewState}
          onMove={(e: ViewStateChangeEvent) => setViewState(e.viewState)}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle={MAPBOX_STYLE}
          style={{ width: '100%', height: '100%' }}
          projection={isGlobe ? 'globe' : 'mercator'}
          cursor={cursor}
          interactiveLayerIds={INTERACTIVE_LAYERS}
          onClick={onMapClick}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          onLoad={onMapLoad}
          maxZoom={14}
          minZoom={1.5}
          attributionControl={false}
        >
          <NavigationControl position="bottom-right" showCompass visualizePitch />
          <ScaleControl position="bottom-left" />

          {/* ============= HEATMAP CHOROPLETH ============= */}
          {showHeatmap && heatmapGeo && (
            <Source id="bmap-heatmap" type="geojson" data={heatmapGeo}>
              <Layer
                id="bmap-heatmap-fill"
                type="fill"
                paint={{
                  'fill-color': heatmapFillExpression,
                  'fill-opacity': 0.65,
                }}
              />
              <Layer
                id="bmap-heatmap-line"
                type="line"
                paint={{
                  'line-color': heatmapLineExpression as any,
                  'line-width': 0.6,
                  'line-opacity': 0.45,
                }}
              />
            </Source>
          )}

          {/* ============= SHALE BASINS ============= */}
          {layers.shaleBasins && (
            <Source id="bmap-basins" type="geojson" data={basinGeo}>
              <Layer
                id="bmap-basin-fill"
                type="fill"
                paint={{
                  'fill-color': LAYER_META.shaleBasins.color,
                  'fill-opacity': 0.15,
                }}
              />
              <Layer
                id="bmap-basin-outline"
                type="line"
                paint={{
                  'line-color': LAYER_META.shaleBasins.color,
                  'line-width': 1,
                  'line-opacity': 0.7,
                  'line-dasharray': [4, 3],
                }}
              />
            </Source>
          )}

          {/* ============= PIPELINES ============= */}
          {layers.pipelines && (
            <Source id="bmap-pipelines" type="geojson" data={pipeGeo}>
              <Layer
                id="bmap-pipeline-glow"
                type="line"
                paint={{
                  'line-color': [
                    'case',
                    ['==', ['get', 'kind'], 'oil'],
                    '#ef4444',
                    '#f59e0b',
                  ] as any,
                  'line-width': 4,
                  'line-opacity': 0.15,
                  'line-blur': 3,
                }}
              />
              <Layer
                id="bmap-pipeline-line"
                type="line"
                paint={{
                  'line-color': [
                    'case',
                    ['==', ['get', 'kind'], 'oil'],
                    '#ef4444',
                    '#f59e0b',
                  ] as any,
                  'line-width': 1.8,
                  'line-opacity': 0.9,
                }}
              />
            </Source>
          )}

          {/* ============= OIL FIELDS ============= */}
          {layers.oilFields && (
            <Source id="bmap-oil" type="geojson" data={oilGeo}>
              <Layer
                id="bmap-oil-glow"
                type="circle"
                paint={{
                  'circle-radius': 10,
                  'circle-color': LAYER_META.oilFields.color,
                  'circle-opacity': 0.15,
                  'circle-blur': 1,
                }}
              />
              <Layer
                id="bmap-oil-circle"
                type="circle"
                paint={{
                  'circle-radius': 5,
                  'circle-color': LAYER_META.oilFields.color,
                  'circle-stroke-width': 1.5,
                  'circle-stroke-color': '#0a0a00',
                }}
              />
            </Source>
          )}

          {/* ============= GAS FIELDS ============= */}
          {layers.gasFields && (
            <Source id="bmap-gas" type="geojson" data={gasGeo}>
              <Layer
                id="bmap-gas-glow"
                type="circle"
                paint={{
                  'circle-radius': 10,
                  'circle-color': LAYER_META.gasFields.color,
                  'circle-opacity': 0.15,
                  'circle-blur': 1,
                }}
              />
              <Layer
                id="bmap-gas-circle"
                type="circle"
                paint={{
                  'circle-radius': 5,
                  'circle-color': LAYER_META.gasFields.color,
                  'circle-stroke-width': 1.5,
                  'circle-stroke-color': '#0a0a00',
                }}
              />
            </Source>
          )}

          {/* ============= REFINERIES ============= */}
          {layers.refineries && (
            <Source id="bmap-refinery" type="geojson" data={refGeo}>
              <Layer
                id="bmap-refinery-glow"
                type="circle"
                paint={{
                  'circle-radius': 10,
                  'circle-color': LAYER_META.refineries.color,
                  'circle-opacity': 0.15,
                  'circle-blur': 1,
                }}
              />
              <Layer
                id="bmap-refinery-circle"
                type="circle"
                paint={{
                  'circle-radius': 6,
                  'circle-color': LAYER_META.refineries.color,
                  'circle-stroke-width': 1.5,
                  'circle-stroke-color': '#0a0a00',
                }}
              />
            </Source>
          )}

          {/* ============= LNG TERMINALS ============= */}
          {layers.lng && (
            <Source id="bmap-lng" type="geojson" data={lngGeo}>
              <Layer
                id="bmap-lng-glow"
                type="circle"
                paint={{
                  'circle-radius': 9,
                  'circle-color': LAYER_META.lng.color,
                  'circle-opacity': 0.18,
                  'circle-blur': 1,
                }}
              />
              <Layer
                id="bmap-lng-circle"
                type="circle"
                paint={{
                  'circle-radius': 4.5,
                  'circle-color': LAYER_META.lng.color,
                  'circle-stroke-width': 1.5,
                  'circle-stroke-color': '#0a0a00',
                }}
              />
            </Source>
          )}

          {/* ============= MINES ============= */}
          {layers.mines && (
            <Source id="bmap-mine" type="geojson" data={mineGeo}>
              <Layer
                id="bmap-mine-glow"
                type="circle"
                paint={{
                  'circle-radius': 10,
                  'circle-color': LAYER_META.mines.color,
                  'circle-opacity': 0.15,
                  'circle-blur': 1,
                }}
              />
              <Layer
                id="bmap-mine-circle"
                type="circle"
                paint={{
                  'circle-radius': 5,
                  'circle-color': LAYER_META.mines.color,
                  'circle-stroke-width': 1.5,
                  'circle-stroke-color': '#0a0a00',
                }}
              />
            </Source>
          )}

          {/* ============= PORTS ============= */}
          {layers.ports && (
            <Source id="bmap-port" type="geojson" data={portGeo}>
              <Layer
                id="bmap-port-glow"
                type="circle"
                paint={{
                  'circle-radius': 8,
                  'circle-color': LAYER_META.ports.color,
                  'circle-opacity': 0.18,
                  'circle-blur': 1,
                }}
              />
              <Layer
                id="bmap-port-circle"
                type="circle"
                paint={{
                  'circle-radius': 4,
                  'circle-color': LAYER_META.ports.color,
                  'circle-stroke-width': 1.5,
                  'circle-stroke-color': '#0a0a00',
                }}
              />
            </Source>
          )}

          {/* ============= WIND FARMS ============= */}
          {layers.windFarms && (
            <Source id="bmap-wind" type="geojson" data={windGeo}>
              <Layer
                id="bmap-wind-glow"
                type="circle"
                paint={{
                  'circle-radius': 10,
                  'circle-color': LAYER_META.windFarms.color,
                  'circle-opacity': 0.2,
                  'circle-blur': 1,
                }}
              />
              <Layer
                id="bmap-wind-circle"
                type="circle"
                paint={{
                  'circle-radius': 5,
                  'circle-color': LAYER_META.windFarms.color,
                  'circle-stroke-width': 1.5,
                  'circle-stroke-color': '#0a0a00',
                }}
              />
            </Source>
          )}

          {/* ============= VESSELS ============= */}
          {layers.vessels && (
            <Source
              id="bmap-vessels"
              type="geojson"
              data={vesselGeo}
              cluster
              clusterMaxZoom={8}
              clusterRadius={40}
            >
              {/* Cluster circles */}
              <Layer
                id="bmap-vessel-cluster"
                type="circle"
                filter={['has', 'point_count']}
                paint={{
                  'circle-color': LAYER_META.vessels.color,
                  'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 30, 22],
                  'circle-opacity': 0.7,
                  'circle-stroke-width': 2,
                  'circle-stroke-color': '#0a0a00',
                }}
              />
              {/* Cluster count label */}
              <Layer
                id="bmap-vessel-cluster-count"
                type="symbol"
                filter={['has', 'point_count']}
                layout={{
                  'text-field': '{point_count_abbreviated}',
                  'text-size': 10,
                  'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
                }}
                paint={{
                  'text-color': '#0a0a00',
                }}
              />
              {/* Individual vessel dots */}
              <Layer
                id="bmap-vessel-glow"
                type="circle"
                filter={['!', ['has', 'point_count']]}
                paint={{
                  'circle-radius': 8,
                  'circle-color': LAYER_META.vessels.color,
                  'circle-opacity': 0.2,
                  'circle-blur': 1,
                }}
              />
              <Layer
                id="bmap-vessel-circle"
                type="circle"
                filter={['!', ['has', 'point_count']]}
                paint={{
                  'circle-radius': 4,
                  'circle-color': LAYER_META.vessels.color,
                  'circle-stroke-width': 1.5,
                  'circle-stroke-color': '#0a0a00',
                }}
              />
            </Source>
          )}

          {/* ============= STORMS ============= */}
          {layers.storms && (
            <>
              <Source id="bmap-storm-tracks" type="geojson" data={stormData.tracks}>
                <Layer
                  id="bmap-storm-track"
                  type="line"
                  paint={{
                    'line-color': LAYER_META.storms.color,
                    'line-width': 1.5,
                    'line-opacity': 0.6,
                    'line-dasharray': [3, 3],
                  }}
                />
              </Source>
              <Source id="bmap-storms" type="geojson" data={stormData.points}>
                {/* Wide halo */}
                <Layer
                  id="bmap-storm-halo"
                  type="circle"
                  paint={{
                    'circle-radius': 22,
                    'circle-color': LAYER_META.storms.color,
                    'circle-opacity': 0.08,
                    'circle-blur': 0.5,
                  }}
                />
                {/* Pulsing ring */}
                <Layer
                  id="bmap-storm-ring"
                  type="circle"
                  paint={{
                    'circle-radius': 14,
                    'circle-color': 'transparent',
                    'circle-stroke-width': 2,
                    'circle-stroke-color': LAYER_META.storms.color,
                    'circle-stroke-opacity': 0.5,
                  }}
                />
                <Layer
                  id="bmap-storm-circle"
                  type="circle"
                  paint={{
                    'circle-radius': [
                      'case',
                      ['>=', ['get', 'category'], 4], 8,
                      ['>=', ['get', 'category'], 2], 6,
                      5,
                    ],
                    'circle-color': [
                      'case',
                      ['>=', ['get', 'category'], 4], '#dc2626',
                      ['>=', ['get', 'category'], 2], '#f97316',
                      '#eab308',
                    ] as any,
                    'circle-stroke-width': 2,
                    'circle-stroke-color': '#0a0a00',
                  }}
                />
              </Source>
            </>
          )}

          {/* ============= LIVE LAYERS ============= */}
          {LIVE_LAYERS.map((layer) => {
            if (!live.enabled[layer.id]) return null;
            const data = live.data[layer.id];
            if (!data) return null;
            const sourceId = `bmap-live-${layer.id}`;
            const layerId = `${sourceId}-${layer.paint}`;
            const paint = (() => {
              if (layer.paint === 'circle') {
                return { 'circle-color': layer.color, ...(layer.paintExtras ?? {}) };
              }
              if (layer.paint === 'fill') {
                return { 'fill-color': layer.color, ...(layer.paintExtras ?? {}) };
              }
              if (layer.paint === 'line') {
                return { 'line-color': layer.color, 'line-width': 1.5, ...(layer.paintExtras ?? {}) };
              }
              return {};
            })();
            return (
              <Source key={sourceId} id={sourceId} type="geojson" data={data}>
                <Layer id={layerId} type={layer.paint as 'circle' | 'fill' | 'line'} paint={paint as any} />
              </Source>
            );
          })}

          {/* AISStream live vessels */}
          {live.vesselsEnabled && live.vessels && (
            <Source id="bmap-aisstream-source" type="geojson" data={live.vessels}>
              <Layer
                id="bmap-aisstream-circle"
                type="circle"
                paint={{
                  'circle-radius': 3,
                  'circle-color': '#22d3ee',
                  'circle-opacity': 0.9,
                  'circle-stroke-color': '#0a0a00',
                  'circle-stroke-width': 0.5,
                }}
              />
            </Source>
          )}

          {/* ============= POPUP ============= */}
          {popupInfo && (
            <Popup
              longitude={popupInfo.lng}
              latitude={popupInfo.lat}
              anchor="bottom"
              onClose={() => setPopupInfo(null)}
              closeButton
              closeOnClick={false}
              className="bmap-mapbox-popup"
              maxWidth="260px"
            >
              <div dangerouslySetInnerHTML={{ __html: popupInfo.html }} />
            </Popup>
          )}
        </MapboxMap>

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

        {/* Indices tape */}
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

        {/* Loading / error overlay */}
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
