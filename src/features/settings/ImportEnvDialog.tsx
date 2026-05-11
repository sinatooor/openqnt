/**
 * Preview + confirm flow for importing keys from a .env file.
 *
 * When opened, immediately fires the native file picker. After the user picks
 * a file, we parse it in the main process and show a checkboxed table with
 * masked values. Selected entries are saved atomically via
 * `keys.saveMany(...)`.
 */
import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { FileUp, Loader2 } from 'lucide-react';
import { keysApi, type ParsedEnvRow } from '@/lib/desktopKeys';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onComplete: (importedCount: number) => void;
}

type Step = 'pick' | 'preview' | 'saving';

export function ImportEnvDialog({ open, onOpenChange, onComplete }: Props) {
  const [step, setStep] = useState<Step>('pick');
  const [filePath, setFilePath] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedEnvRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open && step === 'pick' && !filePath) {
      void pickAndParse();
    }
    if (!open) {
      // Reset when closed
      setStep('pick');
      setFilePath(null);
      setRows([]);
      setSelected({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pickAndParse = async () => {
    try {
      const picked = await keysApi().pickEnvFile();
      if (!picked) {
        onOpenChange(false);
        return;
      }
      setFilePath(picked);
      const parsed = await keysApi().parseEnvFile(picked);
      setRows(parsed);
      // Default: every parsed row pre-selected
      const sel: Record<string, boolean> = {};
      for (const r of parsed) sel[r.key] = true;
      setSelected(sel);
      setStep('preview');
    } catch (e) {
      toast.error(`Could not read file: ${e instanceof Error ? e.message : 'unknown'}`);
      onOpenChange(false);
    }
  };

  const toggle = (key: string) => {
    setSelected((s) => ({ ...s, [key]: !s[key] }));
  };

  const toggleAll = () => {
    const allOn = rows.every((r) => selected[r.key]);
    const next: Record<string, boolean> = {};
    for (const r of rows) next[r.key] = !allOn;
    setSelected(next);
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const handleImport = async () => {
    const toSave = rows
      .filter((r) => selected[r.key])
      .map((r) => ({ key: r.key, value: r.value }));
    if (toSave.length === 0) {
      onOpenChange(false);
      return;
    }
    setStep('saving');
    try {
      await keysApi().saveMany(toSave);
      toast.success(`Imported ${toSave.length} key${toSave.length === 1 ? '' : 's'}`);
      onComplete(toSave.length);
      onOpenChange(false);
    } catch (e) {
      toast.error(`Import failed: ${e instanceof Error ? e.message : 'unknown'}`);
      setStep('preview');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[14px]">
            <FileUp className="w-4 h-4" />
            Import API keys from .env
          </DialogTitle>
          <DialogDescription className="text-[11px]">
            Values are encrypted with your OS keychain before being saved.
          </DialogDescription>
        </DialogHeader>

        {step === 'pick' && (
          <div className="py-12 text-center text-[12px] text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-3" />
            Waiting for file selection…
          </div>
        )}

        {step !== 'pick' && (
          <>
            <div className="text-[11px] text-muted-foreground font-mono break-all border-b border-border/60 pb-2">
              {filePath}
            </div>
            <div className="flex items-center justify-between text-[12px] py-1">
              <span className="text-foreground">
                {rows.length} key{rows.length === 1 ? '' : 's'} found · {selectedCount} selected
              </span>
              <button
                onClick={toggleAll}
                className="text-[11px] text-muted-foreground hover:text-foreground"
              >
                {rows.every((r) => selected[r.key]) ? 'Clear all' : 'Select all'}
              </button>
            </div>
            <div className="max-h-[400px] overflow-y-auto border border-border/60 rounded-md">
              <table className="w-full text-[12px]">
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.key}
                      className="border-b border-border/30 last:border-0 hover:bg-white/[0.02]"
                    >
                      <td className="px-2 py-1.5 w-8">
                        <Checkbox
                          checked={selected[r.key] ?? false}
                          onCheckedChange={() => toggle(r.key)}
                        />
                      </td>
                      <td className="px-2 py-1.5 font-mono text-foreground">{r.key}</td>
                      <td className="px-2 py-1.5 font-mono text-muted-foreground">{r.masked}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DialogFooter className="pt-3">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleImport}
                disabled={selectedCount === 0 || step === 'saving'}
              >
                {step === 'saving' && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                Import {selectedCount} key{selectedCount === 1 ? '' : 's'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
