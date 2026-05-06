/**
 * ConcentrationAlerts — banner of breached limits with quick action to
 * disable / fix. Reads from concentrationLimitsStore.
 */
import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight, Settings2, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  useConcentrationLimitsStore,
  type LimitDimension,
  type Breach,
} from '@/stores/concentrationLimitsStore';
import { useAuditStore } from '@/stores/auditStore';

const DIM_LABEL: Record<LimitDimension, string> = {
  single_name: 'Single name',
  sector: 'Sector',
  country: 'Country',
  currency: 'Currency',
  asset_class: 'Asset class',
};

interface Props {
  /** Pre-computed exposures: dimension → bucket → weight (0..1). */
  exposures: Partial<Record<LimitDimension, Record<string, number>>>;
  accountId: string | null;
}

export function ConcentrationAlerts({ exposures, accountId }: Props) {
  const limits = useConcentrationLimitsStore((s) => s.limits);
  const detect = useConcentrationLimitsStore((s) => s.detectBreaches);
  const addLimit = useConcentrationLimitsStore((s) => s.addLimit);
  const updateLimit = useConcentrationLimitsStore((s) => s.updateLimit);
  const removeLimit = useConcentrationLimitsStore((s) => s.removeLimit);
  const log = useAuditStore((s) => s.log);

  const breaches: Breach[] = useMemo(() => detect(accountId, exposures), [detect, accountId, exposures, limits]);
  const [expanded, setExpanded] = useState(false);

  // Add-limit form
  const [dim, setDim] = useState<LimitDimension>('single_name');
  const [bucket, setBucket] = useState('');
  const [maxPct, setMaxPct] = useState('10');

  const handleAdd = () => {
    const max = parseFloat(maxPct) / 100;
    if (!Number.isFinite(max) || max <= 0 || max > 1) return;
    const lim = addLimit({
      accountId,
      dimension: dim,
      bucket: bucket.trim() || null,
      maxWeight: max,
      label: bucket.trim()
        ? `${DIM_LABEL[dim]} ${bucket.trim()} ≤ ${(max * 100).toFixed(1)}%`
        : `${DIM_LABEL[dim]} (any) ≤ ${(max * 100).toFixed(1)}%`,
      active: true,
    });
    log({
      category: 'risk',
      summary: `Added concentration limit: ${lim.label}`,
      actor: 'user',
      accountId: accountId ?? undefined,
    });
    setBucket('');
  };

  return (
    <Card className={`bg-card/60 backdrop-blur-sm border ${breaches.length > 0 ? 'border-red-500/40' : 'border-border/30'} shadow-trading`}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-foreground text-sm">
          <AlertTriangle className={`w-4 h-4 ${breaches.length > 0 ? 'text-red-400' : 'text-muted-foreground'}`} />
          Concentration limits
          <Badge variant="outline" className={`text-[10px] ${breaches.length > 0 ? 'text-red-400 border-red-500/40' : ''}`}>
            {breaches.length} breach{breaches.length === 1 ? '' : 'es'}
          </Badge>
        </CardTitle>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
        >
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          <Settings2 className="w-3 h-3" />
          Manage
        </button>
      </CardHeader>
      <CardContent className="space-y-2 text-xs">
        {breaches.length > 0 && (
          <div className="space-y-1">
            {breaches.map((b) => (
              <div
                key={b.limitId + b.bucket}
                className="rounded-md border border-red-500/30 bg-red-500/5 px-2 py-1.5 flex items-center justify-between gap-2"
              >
                <div>
                  <span className="text-red-400 font-medium">{b.label}</span>
                  <span className="ml-2 text-muted-foreground">
                    {b.bucket} at {(b.weight * 100).toFixed(1)}% (cap {(b.cap * 100).toFixed(1)}%)
                  </span>
                </div>
                <span className="text-red-400 font-mono text-[11px]">+{b.excessBp.toFixed(0)}bp over</span>
              </div>
            ))}
          </div>
        )}
        {expanded && (
          <div className="space-y-3 rounded-md border border-border/40 p-2">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Active limits</Label>
              {limits.length === 0 ? (
                <p className="text-[11px] text-muted-foreground italic">No limits defined.</p>
              ) : (
                <ul className="space-y-1">
                  {limits.map((l) => (
                    <li
                      key={l.id}
                      className={`flex items-center justify-between gap-2 text-[11px] rounded px-1.5 py-1 ${l.active ? 'bg-muted/20' : 'opacity-50'}`}
                    >
                      <span className="text-foreground truncate flex-1">
                        {DIM_LABEL[l.dimension]} {l.bucket ? `· ${l.bucket}` : '(any)'} ≤ {(l.maxWeight * 100).toFixed(1)}%{l.accountId ? ` · ${l.accountId}` : ''}
                      </span>
                      <button
                        onClick={() => updateLimit(l.id, { active: !l.active })}
                        className="text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        {l.active ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => removeLimit(l.id)}
                        className="text-[10px] text-red-400 hover:text-red-300"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="grid grid-cols-4 gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-[10px]">Dimension</Label>
                <Select value={dim} onValueChange={(v) => setDim(v as LimitDimension)}>
                  <SelectTrigger className="h-8 bg-muted/40 border-border/60 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1e1e2e] border-border/60">
                    {(Object.keys(DIM_LABEL) as LimitDimension[]).map((d) => (
                      <SelectItem key={d} value={d}>{DIM_LABEL[d]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Bucket (opt)</Label>
                <Input
                  value={bucket}
                  onChange={(e) => setBucket(e.target.value)}
                  placeholder="e.g. AAPL, Tech, US, USD"
                  className="h-8 bg-muted/40 border-border/60 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Max %</Label>
                <Input
                  type="number"
                  value={maxPct}
                  onChange={(e) => setMaxPct(e.target.value)}
                  className="h-8 bg-muted/40 border-border/60 text-xs"
                  step="any"
                />
              </div>
              <button
                onClick={handleAdd}
                className="h-8 px-2 rounded bg-primary/20 hover:bg-primary/30 text-primary text-xs flex items-center justify-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ConcentrationAlerts;
