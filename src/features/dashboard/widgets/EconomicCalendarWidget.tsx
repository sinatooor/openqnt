/**
 * EconomicCalendarWidget — Today's economic releases via /api/terminal/calendar
 * (FRED-backed). When FRED is unconfigured, hides the impact list cleanly.
 */
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { terminalApiGet } from '@/features/terminal/apiClient';

interface CalendarEvent {
  id: number | string | null;
  time: string;
  event: string;
  impact: 'High' | 'Medium' | 'Low' | string;
  actual: string;
  forecast: string;
}

interface CalendarResponse {
  source: string;
  asOf: string;
  events: CalendarEvent[];
  error?: string;
}

export default function EconomicCalendarWidget() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [status, setStatus] = useState<'loading' | 'live' | 'empty' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    const ctrl = new AbortController();
    const load = async () => {
      const resp = await terminalApiGet<CalendarResponse>('/api/terminal/calendar', undefined, ctrl.signal);
      if (cancelled) return;
      if (!resp) {
        setStatus('error');
        return;
      }
      if (resp.events?.length) {
        setEvents(resp.events.slice(0, 10));
        setStatus('live');
      } else {
        setStatus('empty');
      }
    };
    void load();
    const id = window.setInterval(load, 5 * 60_000);
    return () => {
      cancelled = true;
      ctrl.abort();
      window.clearInterval(id);
    };
  }, []);

  return (
    <section className="terminal-panel h-full">
      <div className="terminal-panel-header flex items-center justify-between">
        <span className="terminal-title">Economic Calendar</span>
        <span className="text-[9px] text-zinc-500">
          {status === 'live' ? 'FRED · TODAY' : status.toUpperCase()}
        </span>
      </div>
      <div className="space-y-2 p-3">
        {events.length === 0 && (
          <p className="text-center text-[10px] text-zinc-500">
            {status === 'loading'
              ? 'Loading…'
              : status === 'empty'
              ? 'No releases scheduled today.'
              : 'Calendar unavailable. Configure FRED_API_KEY.'}
          </p>
        )}
        {events.map((ev) => (
          <div key={ev.id ?? ev.event} className="terminal-row !py-2 text-xs">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-14 shrink-0 text-zinc-500">{ev.time}</span>
              <span className="truncate font-medium text-zinc-100">{ev.event}</span>
            </div>
            <div className="flex items-center gap-3">
              {ev.actual !== '-' ? (
                <span className="font-mono text-zinc-100">{ev.actual}</span>
              ) : (
                <span className="font-mono text-zinc-500">{ev.forecast}</span>
              )}
              <Badge
                variant={ev.impact === 'High' ? 'destructive' : 'secondary'}
                className="text-[10px] px-1.5 py-0"
              >
                {ev.impact}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
