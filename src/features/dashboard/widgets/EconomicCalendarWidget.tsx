import { Badge } from '@/components/ui/badge';

const EVENTS = [
  { id: 1, time: '08:30 AM', event: 'Initial Jobless Claims', impact: 'High', actual: '215K', forecast: '220K' },
  { id: 2, time: '10:00 AM', event: 'ISM Manufacturing PMI', impact: 'Medium', actual: '-', forecast: '50.2' },
  { id: 3, time: '02:00 PM', event: 'FOMC Press Conference', impact: 'High', actual: '-', forecast: '-' },
];

export default function EconomicCalendarWidget() {
  return (
    <section className="terminal-panel h-full">
      <div className="terminal-panel-header flex items-center justify-between">
        <span className="terminal-title">Economic Calendar</span>
        <span className="text-[9px] text-zinc-500">TODAY</span>
      </div>
      <div className="space-y-2 p-3">
          {EVENTS.map((ev) => (
            <div key={ev.id} className="terminal-row !py-2 text-xs">
              <div className="flex gap-3 items-center">
                <span className="w-14 text-zinc-500">{ev.time}</span>
                <span className="font-medium text-zinc-100">{ev.event}</span>
              </div>
              <div className="flex items-center gap-4">
                {ev.actual !== '-' ? (
                  <span className="font-mono text-zinc-100">{ev.actual}</span>
                ) : (
                  <span className="font-mono text-zinc-500">{ev.forecast}</span>
                )}
                <Badge variant={ev.impact === 'High' ? 'destructive' : 'secondary'} className="text-[10px] px-1.5 py-0">
                  {ev.impact}
                </Badge>
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}
