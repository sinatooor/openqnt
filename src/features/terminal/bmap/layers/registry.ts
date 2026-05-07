/**
 * BMAP layer registry
 * -------------------
 * Each public-API layer (USGS earthquakes, NOAA storms, OpenSky flights,
 * EIA plants, OpenAQ air quality) exposes a uniform shape so the BmapView
 * can render them generically. AISStream is push-driven and lives in its
 * own module (`aisstream.ts`) — it still satisfies this contract.
 */

import type { FeatureCollection } from 'geojson';

import { apiBase } from '@/lib/runtimeConfig';
const BACKEND_URL =
  apiBase();

export type LayerStatus = 'idle' | 'loading' | 'live' | 'error';

export interface LiveLayerConfig {
  id: string;
  label: string;
  description: string;
  /** Refresh in ms; 0 = push-only / no polling. */
  refreshIntervalMs: number;
  paint: 'circle' | 'fill' | 'line' | 'symbol';
  color: string;
  /** Extra paint hints applied to the Mapbox layer */
  paintExtras?: Record<string, unknown>;
  fetch: (signal: AbortSignal) => Promise<FeatureCollection>;
}

async function getJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, { signal, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return (await res.json()) as T;
}

export const LIVE_LAYERS: LiveLayerConfig[] = [
  {
    id: 'usgs-earthquakes',
    label: 'Earthquakes (USGS)',
    description: 'M ≥ 2.5, last 24h',
    refreshIntervalMs: 5 * 60 * 1000,
    paint: 'circle',
    color: '#f97316',
    paintExtras: {
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['coalesce', ['get', 'mag'], 2],
        2, 3,
        5, 8,
        7, 14,
      ],
      'circle-stroke-color': '#000',
      'circle-stroke-width': 1,
      'circle-opacity': 0.85,
    },
    fetch: (signal) =>
      getJson<FeatureCollection>('/api/realtime/usgs/earthquakes?magnitude=2.5', signal),
  },
  {
    id: 'noaa-alerts',
    label: 'Weather alerts (NOAA)',
    description: 'Active US severe-weather warnings',
    refreshIntervalMs: 5 * 60 * 1000,
    paint: 'fill',
    color: '#ef4444',
    paintExtras: {
      'fill-opacity': 0.18,
      'fill-outline-color': '#fca5a5',
    },
    fetch: (signal) => getJson<FeatureCollection>('/api/realtime/noaa/alerts', signal),
  },
  {
    id: 'opensky-flights',
    label: 'Flights (OpenSky)',
    description: 'Live aircraft state vectors',
    refreshIntervalMs: 60 * 1000,
    paint: 'circle',
    color: '#22d3ee',
    paintExtras: {
      'circle-radius': 3,
      'circle-stroke-color': '#0e7490',
      'circle-stroke-width': 0.6,
      'circle-opacity': 0.7,
    },
    fetch: (signal) => getJson<FeatureCollection>('/api/realtime/opensky/states', signal),
  },
  {
    id: 'eia-plants',
    label: 'US power plants (EIA)',
    description: 'Operating generators with capacity',
    refreshIntervalMs: 60 * 60 * 1000,
    paint: 'circle',
    color: '#facc15',
    paintExtras: {
      'circle-radius': [
        'interpolate',
        ['linear'],
        ['coalesce', ['get', 'capacityMw'], 0],
        0, 2,
        500, 6,
        2000, 10,
      ],
      'circle-stroke-color': '#854d0e',
      'circle-stroke-width': 0.5,
    },
    fetch: (signal) => getJson<FeatureCollection>('/api/realtime/eia/plants?limit=2000', signal),
  },
  {
    id: 'openaq-pm25',
    label: 'Air quality (OpenAQ PM2.5)',
    description: 'PM2.5 stations worldwide',
    refreshIntervalMs: 30 * 60 * 1000,
    paint: 'circle',
    color: '#a855f7',
    paintExtras: {
      'circle-radius': 3,
      'circle-color': [
        'interpolate',
        ['linear'],
        ['coalesce', ['get', 'value'], 0],
        0, '#10b981',
        25, '#facc15',
        55, '#f97316',
        100, '#ef4444',
        200, '#7f1d1d',
      ],
    },
    fetch: (signal) =>
      getJson<FeatureCollection>('/api/realtime/openaq/locations?parameter=pm25&limit=1000', signal),
  },
];
