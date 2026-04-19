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

import { Fragment, useMemo, useState } from 'react';
import L from 'leaflet';
import {
  CircleMarker,
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
}

function SidePanel({ layers, counts, onToggle, onAll, total, onRegen }: SidePanelProps) {
  return (
    <aside className="bmap-sidebar">
      <div className="bmap-sidebar-header">
        <span className="bmap-sidebar-title">Layers</span>
        <div className="bmap-sidebar-actions">
          <button className="bmap-btn" onClick={() => onAll(true)}>ALL</button>
          <button className="bmap-btn" onClick={() => onAll(false)}>NONE</button>
        </div>
      </div>
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

  const data: BmapData = useMemo(() => generateBmapData(`BMAP-${seed}`), [seed]);

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

        {/* Bottom overlay - legend */}
        <div className="bmap-overlay-bottom">
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
