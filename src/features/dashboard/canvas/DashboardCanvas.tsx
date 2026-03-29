import { useDashboardStore } from '@/stores/dashboardStore';
import { widgetRegistry, availableWidgetTypes } from './WidgetRegistry';
import { Button } from '@/components/ui/button';
import { Plus, X } from 'lucide-react';
import MarketPulsePanel from '../components/MarketPulsePanel';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function DashboardCanvas() {
  const { widgets, addWidget, removeWidget, resetToDefault } = useDashboardStore();

  return (
    <div className="space-y-3">
      <div className="terminal-commandbar">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-amber-400">DASHBOARD</span>
          <span className="text-[10px] text-zinc-500">|</span>
          <span className="text-[10px] text-zinc-500">Bloomberg-style workspace</span>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1 border-zinc-700 bg-zinc-900 text-[11px]">
                <Plus className="h-3.5 w-3.5" /> Add Widget
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {availableWidgetTypes.map((type) => (
                <DropdownMenuItem key={type} onClick={() => addWidget(type)}>
                  {widgetRegistry[type].name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            className="h-7 border-zinc-700 bg-zinc-900 text-[11px]"
            onClick={resetToDefault}
          >
            Reset Layout
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_300px]">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-12">
          {widgets.map((widget) => {
            const WidgetComponent = widgetRegistry[widget.type]?.component;
            if (!WidgetComponent) return null;

            const colSpan =
              widget.w >= 12 ? 'lg:col-span-12' : widget.w >= 6 ? 'lg:col-span-6' : 'lg:col-span-4';
            const rowSpan =
              widget.h >= 4
                ? 'row-span-4 min-h-[280px]'
                : widget.h >= 3
                  ? 'row-span-3 min-h-[220px]'
                  : 'row-span-2 min-h-[180px]';

            return (
              <div key={widget.id} className={`relative group ${colSpan} ${rowSpan}`}>
                <div className="absolute right-2 top-2 z-10 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-full bg-zinc-900/90 text-zinc-300 hover:bg-red-600 hover:text-white"
                    onClick={() => removeWidget(widget.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
                {WidgetComponent}
              </div>
            );
          })}
          {widgets.length === 0 && (
            <div className="lg:col-span-12 flex min-h-[320px] flex-col items-center justify-center rounded border border-dashed border-zinc-700 bg-black/50 py-20">
              <p className="mb-4 text-sm text-zinc-500">No widgets on your dashboard.</p>
              <Button variant="outline" onClick={() => addWidget('indices')}>
                Add World Indices
              </Button>
            </div>
          )}
        </div>
        <MarketPulsePanel />
      </div>
      <div className="terminal-footerbar flex items-center justify-between px-3 py-1.5 text-[10px] text-zinc-500">
        <span>FINCEPT TERMINAL v1.0.0</span>
        <span className="text-emerald-400">FEEDS: CONNECTED</span>
        <span>LAT: 120ms</span>
      </div>
    </div>
  );
}