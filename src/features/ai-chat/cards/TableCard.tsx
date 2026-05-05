/**
 * TableCard — renders tabular data inline.
 *
 * Backend contract:
 *   payload: {
 *     columns: [{ key, label, format? }],
 *     rows: object[],
 *     caption?: string,
 *   }
 */

import { motion } from 'framer-motion';
import { Table as TableIcon, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { PinButton } from '../components/PinButton';

interface Column {
  key: string;
  label: string;
  format?: 'number' | 'percent' | 'currency';
}
interface Props {
  payload: {
    columns: Column[];
    rows: Record<string, any>[];
    caption?: string;
  };
}

const fmt = (v: any, format?: string) => {
  if (v == null) return '—';
  if (format === 'percent' && typeof v === 'number') return `${(v * 100).toFixed(2)}%`;
  if (format === 'currency' && typeof v === 'number') return `$${v.toLocaleString()}`;
  if (format === 'number' && typeof v === 'number') return v.toLocaleString();
  return String(v);
};

export function TableCard({ payload }: Props) {
  const { columns, rows = [], caption } = payload;
  if (!columns?.length) return null;

  const downloadCsv = () => {
    const header = columns.map((c) => c.label).join(',');
    const body = rows
      .map((r) => columns.map((c) => JSON.stringify(r[c.key] ?? '')).join(','))
      .join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `data.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="mt-2 rounded-lg border border-teal-500/20 bg-teal-500/5 overflow-hidden"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-teal-500/10">
        <div className="flex items-center gap-2 text-xs text-teal-300">
          <TableIcon className="w-3.5 h-3.5" />
          <span className="font-medium">{caption ?? 'Data'}</span>
          <span className="text-white/30 ml-1">· {rows.length} rows</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={downloadCsv}
            className="h-6 px-2 text-[11px] text-white/60 hover:text-white hover:bg-white/5"
          >
            <Download className="w-3 h-3 mr-1" /> CSV
          </Button>
          <PinButton cardType="table" payload={payload} title={caption} />
        </div>
      </div>
      <div className="overflow-x-auto max-h-[320px]">
        <table className="w-full text-[11px]">
          <thead className="bg-white/[0.02] sticky top-0">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="text-left px-3 py-1.5 text-white/50 font-medium">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-white/[0.04]">
                {columns.map((c) => (
                  <td key={c.key} className="px-3 py-1 text-white/80 tabular-nums">
                    {fmt(r[c.key], c.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
