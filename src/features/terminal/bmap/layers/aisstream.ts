/**
 * Live AIS vessel feed via the backend proxy at
 *   ws://<backend>/api/realtime/aisstream/ws
 *
 * Maintains a rolling Map of MMSI -> latest position + ship-static metadata,
 * and emits a debounced GeoJSON FeatureCollection to subscribers.
 */

import type { FeatureCollection, Feature, Point } from 'geojson';

interface VesselState {
  mmsi: number;
  lat: number;
  lon: number;
  cog?: number;
  sog?: number;
  name?: string;
  type?: number;
  destination?: string;
  ts: number;
}

const BACKEND_URL =
  (import.meta.env?.VITE_BACKEND_URL as string | undefined) || 'http://localhost:8000';

function wsUrl(path: string): string {
  const u = new URL(BACKEND_URL);
  u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:';
  u.pathname = path;
  return u.toString();
}

export class AISStreamClient {
  private ws: WebSocket | null = null;
  private vessels = new Map<number, VesselState>();
  private listeners = new Set<(fc: FeatureCollection<Point>) => void>();
  private flushTimer: number | null = null;

  connect(bbox?: string): void {
    if (this.ws) return;
    const path = bbox ? `/api/realtime/aisstream/ws?bbox=${encodeURIComponent(bbox)}` : '/api/realtime/aisstream/ws';
    this.ws = new WebSocket(wsUrl(path));
    this.ws.onmessage = (e) => this.handle(e.data);
    this.ws.onerror = () => this.disconnect();
    this.ws.onclose = () => {
      this.ws = null;
    };
  }

  disconnect(): void {
    if (this.ws) {
      try {
        this.ws.close();
      } catch {/* ignore */}
      this.ws = null;
    }
    if (this.flushTimer != null) {
      window.clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
  }

  subscribe(fn: (fc: FeatureCollection<Point>) => void): () => void {
    this.listeners.add(fn);
    fn(this.snapshot());
    return () => {
      this.listeners.delete(fn);
    };
  }

  snapshot(): FeatureCollection<Point> {
    const features: Feature<Point>[] = [];
    for (const v of this.vessels.values()) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [v.lon, v.lat] },
        properties: {
          mmsi: v.mmsi,
          name: v.name ?? `MMSI ${v.mmsi}`,
          cog: v.cog ?? null,
          sog: v.sog ?? null,
          type: v.type ?? null,
          destination: v.destination ?? null,
        },
      });
    }
    return { type: 'FeatureCollection', features };
  }

  private handle(data: unknown): void {
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(typeof data === 'string' ? data : '');
    } catch {
      return;
    }
    if (!parsed || typeof parsed !== 'object') return;
    const messageType = parsed.MessageType as string | undefined;
    const meta = (parsed.MetaData ?? {}) as Record<string, unknown>;
    const mmsi = Number(meta.MMSI ?? 0);
    if (!mmsi) return;

    if (messageType === 'PositionReport') {
      const message = (parsed.Message ?? {}) as Record<string, unknown>;
      const report = (message.PositionReport ?? {}) as Record<string, unknown>;
      const lat = Number(report.Latitude);
      const lon = Number(report.Longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      const prev = this.vessels.get(mmsi) ?? { mmsi, lat, lon, ts: Date.now() };
      this.vessels.set(mmsi, {
        ...prev,
        lat,
        lon,
        cog: typeof report.Cog === 'number' ? (report.Cog as number) : prev.cog,
        sog: typeof report.Sog === 'number' ? (report.Sog as number) : prev.sog,
        ts: Date.now(),
      });
      this.scheduleFlush();
    } else if (messageType === 'ShipStaticData') {
      const message = (parsed.Message ?? {}) as Record<string, unknown>;
      const data = (message.ShipStaticData ?? {}) as Record<string, unknown>;
      const prev = this.vessels.get(mmsi);
      if (!prev) return;
      this.vessels.set(mmsi, {
        ...prev,
        name: typeof data.Name === 'string' ? (data.Name as string).trim() : prev.name,
        type: typeof data.Type === 'number' ? (data.Type as number) : prev.type,
        destination:
          typeof data.Destination === 'string' ? (data.Destination as string).trim() : prev.destination,
      });
    }
  }

  private scheduleFlush(): void {
    if (this.flushTimer != null) return;
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = null;
      const snap = this.snapshot();
      for (const fn of this.listeners) fn(snap);
    }, 1000);
  }
}

export const aisStreamClient = new AISStreamClient();
