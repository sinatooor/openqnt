/**
 * useLiveLayers
 * -------------
 * Hook that owns the user-toggled set of live BMAP layers, fetches each
 * one on a per-layer interval, and returns the GeoJSON to render plus
 * a status map for the sidebar UI.
 */

import { useEffect, useRef, useState } from 'react';
import type { FeatureCollection, Point } from 'geojson';
import { LIVE_LAYERS, type LayerStatus } from './registry';
import { aisStreamClient } from './aisstream';

export interface LiveLayerSnapshot {
  enabled: Record<string, boolean>;
  status: Record<string, LayerStatus>;
  data: Record<string, FeatureCollection | null>;
  vessels: FeatureCollection<Point> | null;
  vesselsEnabled: boolean;
  toggle: (id: string) => void;
  toggleVessels: () => void;
  refresh: (id: string) => void;
}

const EMPTY_FC: FeatureCollection = { type: 'FeatureCollection', features: [] };

export function useLiveLayers(): LiveLayerSnapshot {
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(LIVE_LAYERS.map((l) => [l.id, false])),
  );
  const [status, setStatus] = useState<Record<string, LayerStatus>>(() =>
    Object.fromEntries(LIVE_LAYERS.map((l) => [l.id, 'idle'])),
  );
  const [data, setData] = useState<Record<string, FeatureCollection | null>>(() =>
    Object.fromEntries(LIVE_LAYERS.map((l) => [l.id, null])),
  );
  const [vesselsEnabled, setVesselsEnabled] = useState(false);
  const [vessels, setVessels] = useState<FeatureCollection<Point> | null>(null);

  const controllers = useRef<Record<string, AbortController | null>>({});
  const timers = useRef<Record<string, number | null>>({});
  const latestEnabled = useRef(enabled);
  latestEnabled.current = enabled;

  useEffect(() => {
    LIVE_LAYERS.forEach((layer) => {
      const isOn = enabled[layer.id];
      if (!isOn) {
        if (controllers.current[layer.id]) {
          controllers.current[layer.id]?.abort();
          controllers.current[layer.id] = null;
        }
        if (timers.current[layer.id] != null) {
          window.clearInterval(timers.current[layer.id]!);
          timers.current[layer.id] = null;
        }
        return;
      }
      // already running
      if (timers.current[layer.id] != null) return;

      const run = async () => {
        if (!latestEnabled.current[layer.id]) return;
        controllers.current[layer.id]?.abort();
        const ac = new AbortController();
        controllers.current[layer.id] = ac;
        setStatus((s) => ({ ...s, [layer.id]: 'loading' }));
        try {
          const fc = await layer.fetch(ac.signal);
          setData((d) => ({ ...d, [layer.id]: fc ?? EMPTY_FC }));
          setStatus((s) => ({ ...s, [layer.id]: 'live' }));
        } catch (err) {
          if ((err as Error)?.name === 'AbortError') return;
          setStatus((s) => ({ ...s, [layer.id]: 'error' }));
        }
      };

      void run();
      if (layer.refreshIntervalMs > 0) {
        timers.current[layer.id] = window.setInterval(run, layer.refreshIntervalMs);
      }
    });

    return () => {
      Object.values(timers.current).forEach((t) => t != null && window.clearInterval(t));
      Object.values(controllers.current).forEach((c) => c?.abort());
    };
  }, [enabled]);

  useEffect(() => {
    if (!vesselsEnabled) {
      aisStreamClient.disconnect();
      setVessels(null);
      return;
    }
    aisStreamClient.connect();
    const unsub = aisStreamClient.subscribe(setVessels);
    return () => {
      unsub();
    };
  }, [vesselsEnabled]);

  return {
    enabled,
    status,
    data,
    vessels,
    vesselsEnabled,
    toggle: (id) => setEnabled((e) => ({ ...e, [id]: !e[id] })),
    toggleVessels: () => setVesselsEnabled((v) => !v),
    refresh: (id) => {
      const layer = LIVE_LAYERS.find((l) => l.id === id);
      if (!layer || !enabled[id]) return;
      controllers.current[id]?.abort();
      controllers.current[id] = null;
      // toggling and re-toggling re-runs the effect which re-fetches.
      setEnabled((e) => ({ ...e, [id]: false }));
      requestAnimationFrame(() => setEnabled((e) => ({ ...e, [id]: true })));
    },
  };
}
