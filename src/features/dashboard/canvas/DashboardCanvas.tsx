import { useCallback, useMemo } from 'react';
import {
  ResponsiveGridLayout,
  useContainerWidth,
  type Layout,
  type ResponsiveLayouts,
} from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import { useDashboardStore } from '@/stores/dashboardStore';
import { widgetRegistry, availableWidgetTypes } from './WidgetRegistry';
import { Button } from '@/components/ui/button';
import { Plus, X, GripVertical } from 'lucide-react';
import MarketPulsePanel from '../components/MarketPulsePanel';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function DashboardCanvas() {
  const { layout, widgetTypes, addWidget, removeWidget, updateLayout, resetToDefault } =
    useDashboardStore();

  const { width, containerRef, mounted } = useContainerWidth({ initialWidth: 1200 });

  const handleLayoutChange = useCallback(
    (currentLayout: Layout, _allLayouts: ResponsiveLayouts) => {
      updateLayout(currentLayout);
    },
    [updateLayout],
  );

  const layouts = useMemo<ResponsiveLayouts>(
    () => ({
      lg: layout,
      md: layout.map((l) => ({ ...l, w: Math.min(l.w, 10) })),
      sm: layout.map((l) => ({ ...l, w: 6, x: 0 })),
      xs: layout.map((l) => ({ ...l, w: 4, x: 0 })),
    }),
    [layout],
  );

  return (
    <div className="space-y-3">
      {/* Command bar */}
      <div className="terminal-commandbar flex items-center justify-between px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-amber-400">DASHBOARD</span>
          <span className="text-[10px] text-zinc-500">|</span>
          <span className="text-[10px] text-zinc-500">
            Drag headers to move — drag edges to resize
          </span>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 border-zinc-700 bg-zinc-900 text-[11px]"
              >
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

      {/* Main grid + pulse sidebar */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_320px]">
        <div ref={containerRef}>
          {mounted && (
            <ResponsiveGridLayout
              className="dashboard-grid"
              width={width}
              layouts={layouts}
              breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
              cols={{ lg: 12, md: 10, sm: 6, xs: 4 }}
              rowHeight={58}
              margin={[6, 6]}
              containerPadding={[0, 0]}
              dragConfig={{
                enabled: true,
                handle: '.widget-drag-handle',
              }}
              resizeConfig={{
                enabled: true,
                handles: ['se', 'e', 's'],
              }}
              onLayoutChange={handleLayoutChange}
              autoSize
            >
              {layout.map((item) => {
                const widgetType = widgetTypes[item.i];
                const def = widgetType ? widgetRegistry[widgetType] : null;
                if (!def) return <div key={item.i} />;
                const { Component } = def;

                return (
                  <div key={item.i} className="group relative">
                    {/* Drag handle bar — visible on hover */}
                    <div className="widget-drag-handle absolute inset-x-0 top-0 z-20 flex h-7 cursor-grab items-center justify-between rounded-t-sm bg-gradient-to-b from-zinc-900/95 to-transparent px-2 opacity-0 transition-opacity group-hover:opacity-100 active:cursor-grabbing">
                      <div className="flex items-center gap-1.5">
                        <GripVertical className="h-3.5 w-3.5 text-amber-400/70" />
                        <span className="text-[9px] text-zinc-500">
                          {def.name}
                        </span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 rounded-full bg-zinc-800/90 text-zinc-400 hover:bg-red-600 hover:text-white"
                        onClick={() => removeWidget(item.i)}
                        onMouseDown={(e) => e.stopPropagation()}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Widget content — fills the grid cell */}
                    <div className="h-full w-full overflow-hidden">
                      <Component />
                    </div>
                  </div>
                );
              })}
            </ResponsiveGridLayout>
          )}

          {/* Empty state */}
          {layout.length === 0 && (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded border border-dashed border-zinc-700 bg-black/50 py-20">
              <p className="mb-4 text-sm text-zinc-500">No widgets on your dashboard.</p>
              <Button variant="outline" onClick={() => addWidget('indices')}>
                Add World Indices
              </Button>
            </div>
          )}
        </div>

        <MarketPulsePanel />
      </div>

      {/* Footer */}
      <div className="terminal-footerbar flex items-center justify-between px-3 py-1.5 text-[10px] text-zinc-500">
        <span>FINCEPT TERMINAL v1.0.0</span>
        <span className="text-emerald-400">FEEDS: CONNECTED</span>
        <span>LAT: 120ms</span>
      </div>
    </div>
  );
}
