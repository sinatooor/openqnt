/**
 * useTerminalData — small helper hook for terminal views.
 *
 * Terminal tools expose `fetch(input): TData | Promise<TData>`. We want views
 * to:
 *
 *   1. Render *instantly* with a deterministic mock fallback (so the screen
 *      never flashes empty).
 *   2. Transparently upgrade to live data the moment the backend promise
 *      resolves.
 *   3. Cancel in-flight updates when the input changes, to avoid out-of-order
 *      writes bleeding the wrong ticker's data into state.
 */

import { useEffect, useRef, useState } from 'react';
import type { TerminalTool } from './agentTools/types';

export function useTerminalData<TInput, TData>(
  tool: TerminalTool<TInput, TData>,
  input: TInput,
  fallback: () => TData,
): TData {
  const [data, setData] = useState<TData>(() => fallback());
  const inputKey = safeKey(input);
  const keyRef = useRef(inputKey);

  useEffect(() => {
    keyRef.current = inputKey;
    setData(fallback());
    let cancelled = false;
    try {
      const result = tool.fetch(input);
      if (isPromise<TData>(result)) {
        result
          .then((d) => {
            if (!cancelled && keyRef.current === inputKey) setData(d);
          })
          .catch(() => {
            /* backend unreachable — keep the sync fallback */
          });
      } else {
        setData(result);
      }
    } catch {
      /* fall back silently */
    }
    return () => {
      cancelled = true;
    };
    // `input` is stringified into inputKey for stable deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool, inputKey]);

  return data;
}

function isPromise<T>(value: unknown): value is Promise<T> {
  return (
    !!value &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

function safeKey(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
