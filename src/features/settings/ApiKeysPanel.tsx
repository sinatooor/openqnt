/**
 * Settings → API Keys panel.
 *
 * Lists encrypted, OS-keychain-backed keys for LLM providers, brokers, and
 * data feeds. Supports inline add, click-to-reveal, delete, and bulk import
 * from a .env file (preview-and-confirm).
 *
 * Web/dev builds: panel is read-only with a banner explaining that key
 * management requires the desktop app.
 */
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  Eye,
  EyeOff,
  Trash2,
  FileUp,
  Plus,
  AlertCircle,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import {
  isDesktopApp,
  keysAvailable,
  keysApi,
  relaunchApp,
  type MaskedSecret,
} from '@/lib/desktopKeys';
import { ImportEnvDialog } from './ImportEnvDialog';

export function ApiKeysPanel() {
  const desktop = isDesktopApp() && keysAvailable();
  const [keys, setKeys] = useState<MaskedSecret[]>([]);
  const [loading, setLoading] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [revealed, setRevealed] = useState<Record<string, string | undefined>>({});
  const [dirty, setDirty] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const refresh = async () => {
    if (!desktop) return;
    setLoading(true);
    try {
      const next = await keysApi().list();
      setKeys(next);
    } catch (e) {
      toast.error(`Could not load keys: ${e instanceof Error ? e.message : 'unknown'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReveal = async (key: string) => {
    if (revealed[key] !== undefined) {
      setRevealed((r) => ({ ...r, [key]: undefined }));
      return;
    }
    try {
      const v = await keysApi().reveal(key);
      setRevealed((r) => ({ ...r, [key]: v ?? '' }));
    } catch (e) {
      toast.error(`Could not reveal: ${e instanceof Error ? e.message : 'unknown'}`);
    }
  };

  const handleDelete = async (key: string) => {
    if (!window.confirm(`Delete ${key}? This cannot be undone.`)) return;
    try {
      await keysApi().delete(key);
      toast.success(`Deleted ${key}`);
      setDirty(true);
      void refresh();
    } catch (e) {
      toast.error(`Delete failed: ${e instanceof Error ? e.message : 'unknown'}`);
    }
  };

  const handleAdd = async () => {
    const k = newKey.trim();
    if (!k || !newValue) return;
    try {
      await keysApi().save(k, newValue);
      toast.success(`Saved ${k}`);
      setNewKey('');
      setNewValue('');
      setShowAddForm(false);
      setDirty(true);
      void refresh();
    } catch (e) {
      toast.error(`Save failed: ${e instanceof Error ? e.message : 'unknown'}`);
    }
  };

  const handleImportDone = (count: number) => {
    if (count > 0) {
      setDirty(true);
      void refresh();
    }
  };

  const handleRestart = async () => {
    setRestarting(true);
    await relaunchApp();
  };

  if (!desktop) {
    return (
      <div className="rounded-md border border-border/60 bg-card/40 p-3 text-[12px] text-muted-foreground">
        API key management is available in the desktop app. For browser / dev
        builds, set keys in{' '}
        <code className="px-1 py-0.5 rounded bg-muted text-foreground font-mono">
          backend/.env
        </code>{' '}
        as before.
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2 pb-3">
        <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
          <FileUp className="w-3.5 h-3.5 mr-1.5" />
          Import .env
        </Button>
        <Button size="sm" variant="outline" onClick={() => setShowAddForm((s) => !s)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          Add key
        </Button>
        <span className="ml-auto text-[11px] text-muted-foreground flex items-center gap-1.5">
          {loading && <Loader2 className="w-3 h-3 animate-spin" />}
          {keys.length} key{keys.length === 1 ? '' : 's'} saved
        </span>
      </div>

      {showAddForm && (
        <div className="rounded-md border border-border/60 bg-card/40 p-3 grid grid-cols-[1fr_1fr_auto] gap-2 mb-2 items-center">
          <Input
            placeholder="ANTHROPIC_API_KEY"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
            className="font-mono text-[12px] h-8"
          />
          <Input
            placeholder="value (will be encrypted)"
            type="password"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="font-mono text-[12px] h-8"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleAdd();
            }}
          />
          <Button size="sm" onClick={handleAdd} disabled={!newKey || !newValue}>
            Save
          </Button>
        </div>
      )}

      <div className="rounded-md border border-border/60 overflow-hidden">
        {keys.length === 0 ? (
          <div className="p-6 text-center text-[12px] text-muted-foreground">
            No keys saved yet. Import a .env file or add keys manually.
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead className="bg-muted/30 border-b border-border/60">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-[11px] uppercase tracking-wider text-muted-foreground">
                  Key
                </th>
                <th className="text-left px-3 py-2 font-medium text-[11px] uppercase tracking-wider text-muted-foreground">
                  Value
                </th>
                <th className="text-left px-3 py-2 font-medium text-[11px] uppercase tracking-wider text-muted-foreground">
                  Updated
                </th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody>
              {keys.map(({ key, masked, updatedAt }) => (
                <tr
                  key={key}
                  className="border-b border-border/30 last:border-0 hover:bg-white/[0.02]"
                >
                  <td className="px-3 py-2 font-mono text-foreground">{key}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">
                    {revealed[key] !== undefined ? (
                      <span className="text-foreground select-all break-all">
                        {revealed[key]}
                      </span>
                    ) : (
                      masked
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground text-[11px]">
                    {new Date(updatedAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button
                      onClick={() => handleReveal(key)}
                      className="p-1 text-muted-foreground hover:text-foreground inline-flex"
                      title={revealed[key] !== undefined ? 'Hide' : 'Reveal'}
                    >
                      {revealed[key] !== undefined ? (
                        <EyeOff className="w-3.5 h-3.5" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(key)}
                      className="p-1 text-muted-foreground hover:text-red-400 inline-flex"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {dirty && (
        <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/[0.06] p-3 flex items-center gap-2 text-[12px]">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-foreground flex-1">
            Backend will read these keys on next launch. Restart to apply now.
          </span>
          <Button size="sm" variant="outline" onClick={handleRestart} disabled={restarting}>
            {restarting ? (
              <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            )}
            Restart app
          </Button>
        </div>
      )}

      <ImportEnvDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onComplete={handleImportDone}
      />
    </>
  );
}
