/**
 * BrainPanel — browser + editor for the copilot's shared memory brain
 * (`<DATA_DIR>/memory/`: soul.md, user.md, portfolio.md, watchlist.md,
 * market.md, lessons.md, journal.md, assets/<TICKER>.md).
 *
 * Left  · grouped file tree (Identity / Knowledge / Activity / Assets)
 * Right · MemoryView-style markdown viewer with an edit toggle, plus
 *         "reset to default" for files that ship with a template.
 *
 * Backed by the REST API in `../api/memoryApi` — unlike MemoryView, nothing
 * here touches the per-agent zustand store: this is the copilot's brain, not
 * an agent's scratchpad.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  BookText,
  BrainCircuit,
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  createAssetFile,
  listMemoryFiles,
  readMemoryFile,
  resetMemoryFile,
  writeMemoryFile,
  type MemoryFileMeta,
} from '../api/memoryApi';

// ── File grouping ──────────────────────────────────────────────────────

interface FileGroup {
  title: string;
  subtitle: string;
  files: MemoryFileMeta[];
}

const IDENTITY = ['soul.md', 'user.md'];
const KNOWLEDGE = ['portfolio.md', 'watchlist.md', 'market.md', 'lessons.md'];
const ACTIVITY = ['journal.md'];

function groupFiles(files: MemoryFileMeta[]): FileGroup[] {
  const byName = new Map(files.map((f) => [f.name, f]));
  const pick = (names: string[]) =>
    names.map((n) => byName.get(n)).filter((f): f is MemoryFileMeta => Boolean(f));
  const assets = files
    .filter((f) => f.name.startsWith('assets/'))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [
    { title: 'Identity', subtitle: 'Who the copilot is · who you are', files: pick(IDENTITY) },
    { title: 'Knowledge', subtitle: 'The book, the market, the playbook', files: pick(KNOWLEDGE) },
    { title: 'Activity', subtitle: 'Rolling log of what it did', files: pick(ACTIVITY) },
    { title: 'Assets', subtitle: 'One note per held/watchlist ticker', files: assets },
  ];
}

function fileLabel(meta: MemoryFileMeta): string {
  if (meta.name.startsWith('assets/')) return meta.name.slice('assets/'.length, -'.md'.length);
  return meta.title.split('(')[0].trim();
}

const fmtSize = (bytes: number): string =>
  bytes >= 1024 ? `${(bytes / 1024).toFixed(1)} kB` : `${bytes} B`;

// ── Panel ──────────────────────────────────────────────────────────────

export const BrainPanel = memo(() => {
  const [files, setFiles] = useState<MemoryFileMeta[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [selected, setSelected] = useState<string>('soul.md');
  // Bumped by the header Refresh button so the open editor re-reads its file
  // (the agent may have written to it since it was loaded).
  const [refreshTick, setRefreshTick] = useState(0);

  const refreshList = useCallback(async () => {
    setLoadingList(true);
    try {
      setFiles(await listMemoryFiles());
      setListError(null);
    } catch (e) {
      setListError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingList(false);
    }
  }, []);

  const refreshAll = useCallback(() => {
    setRefreshTick((t) => t + 1);
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  const groups = useMemo(() => groupFiles(files), [files]);
  const selectedMeta = files.find((f) => f.name === selected) ?? null;

  const onAssetCreated = useCallback(
    async (name: string) => {
      await refreshList();
      setSelected(name);
    },
    [refreshList]
  );

  return (
    <div className="h-full flex flex-col">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-border/60 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 bg-primary/15 text-primary">
            <BrainCircuit className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-foreground font-medium truncate">Copilot Brain</p>
            <p className="text-[10px] text-muted-foreground truncate">
              Long-term memory · learns after every run &amp; chat · yours to edit
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2 text-[10px] gap-1 border-border/60 text-foreground/70 hover:text-foreground shrink-0"
          onClick={refreshAll}
          aria-label="Refresh memory files"
        >
          <RefreshCw className={cn('w-3 h-3', loadingList && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* ── Body: file tree + editor ────────────────────────── */}
      <div className="flex-1 min-h-0 grid grid-cols-[190px_minmax(0,1fr)]">
        <div className="border-r border-border/60 min-h-0 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-3">
              {listError && (
                <div className="px-2 py-1.5 space-y-1.5">
                  <p className="text-[11px] text-red-400">
                    {listError} — is the backend running?
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[10px] gap-1 border-border/60 text-foreground/70 hover:text-foreground"
                    onClick={refreshAll}
                  >
                    <RefreshCw className="w-3 h-3" />
                    Retry
                  </Button>
                </div>
              )}
              {/* With no list at all, groups are just empty shells and the
                  Add-ticker input would create files we can't display. */}
              {!(listError && files.length === 0) && groups.map((g) => (
                <div key={g.title}>
                  <div className="px-2 pb-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                      {g.title}
                    </p>
                    <p className="text-[9px] text-muted-foreground">{g.subtitle}</p>
                  </div>
                  <div className="space-y-1">
                    {g.files.map((f) => (
                      <FileRow
                        key={f.name}
                        meta={f}
                        selected={selected === f.name}
                        onSelect={setSelected}
                      />
                    ))}
                    {g.title === 'Assets' && (
                      <>
                        {g.files.length === 0 && (
                          <p className="text-[10px] text-muted-foreground px-2 py-1">
                            None yet — the agent creates these as it learns.
                          </p>
                        )}
                        <AddAssetRow onCreated={onAssetCreated} />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>

        <div className="min-h-0">
          {selectedMeta ? (
            <MemoryFileEditor
              key={selectedMeta.name}
              meta={selectedMeta}
              refreshTick={refreshTick}
              onSaved={() => void refreshList()}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-[12px] text-muted-foreground">
              {loadingList ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Select a memory file'
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

BrainPanel.displayName = 'BrainPanel';

// ── File row ───────────────────────────────────────────────────────────

interface FileRowProps {
  meta: MemoryFileMeta;
  selected: boolean;
  onSelect: (name: string) => void;
}

const FileRow = memo(({ meta, selected, onSelect }: FileRowProps) => (
  <div
    role="button"
    tabIndex={0}
    onClick={() => onSelect(meta.name)}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(meta.name);
      }
    }}
    className={cn(
      'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors border cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20',
      selected
        ? 'bg-muted/30 border-border/60'
        : 'bg-transparent border-transparent hover:bg-muted/30 hover:border-border/60'
    )}
  >
    <BookText className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
    <div className="flex-1 min-w-0">
      <span className="block text-xs text-foreground truncate">{fileLabel(meta)}</span>
      <span className="block text-[10px] text-muted-foreground truncate font-mono">
        {meta.name}
      </span>
    </div>
    {!meta.agent_writable && (
      <span className="text-[9px] text-muted-foreground shrink-0" title="The agent never edits this file — only you do.">
        yours
      </span>
    )}
  </div>
));

FileRow.displayName = 'FileRow';

// ── Add-asset row ──────────────────────────────────────────────────────

const AddAssetRow = ({ onCreated }: { onCreated: (name: string) => void | Promise<void> }) => {
  const [ticker, setTicker] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const t = ticker.trim().toUpperCase();
    if (!t || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createAssetFile(t);
      setTicker('');
      // Await the full refresh-and-select so `busy` covers the whole sequence
      // (otherwise the spinner stops before the new row appears).
      await onCreated(created.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-2 pt-1">
      <div className="flex items-center gap-1">
        <Input
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void submit();
          }}
          placeholder="Add ticker…"
          className="h-6 px-2 text-[11px] font-mono bg-transparent border-border/60"
          aria-label="New asset ticker"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-6 w-6 p-0 border-border/60 text-foreground/70 hover:text-foreground shrink-0"
          onClick={() => void submit()}
          disabled={busy || !ticker.trim()}
          aria-label="Create asset note"
        >
          {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
        </Button>
      </div>
      {error && <p className="text-[10px] text-red-400 mt-1">{error}</p>}
    </div>
  );
};

// ── Editor (MemoryView's view/edit pattern, REST-backed) ──────────────

interface MemoryFileEditorProps {
  meta: MemoryFileMeta;
  /** Bumped by the panel's Refresh button — triggers a re-read of the file. */
  refreshTick: number;
  onSaved: () => void;
}

const MemoryFileEditor = ({ meta, refreshTick, onSaved }: MemoryFileEditorProps) => {
  const [content, setContent] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ref mirror so load() can check edit state without re-creating itself
  // (and without a background refresh clobbering an in-progress draft).
  const editingRef = useRef(editing);
  editingRef.current = editing;

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setContent(null);
      setError(null);
      try {
        const r = await readMemoryFile(meta.name);
        setContent(r.content);
        if (!editingRef.current) setDraft(r.content);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [meta.name]
  );

  // Initial load (component remounts per file via key={name}).
  useEffect(() => {
    void load();
  }, [load]);

  // Panel-level Refresh: re-read this file too — the agent may have updated
  // it — but never while the user is mid-edit.
  const firstTick = useRef(true);
  useEffect(() => {
    if (firstTick.current) {
      firstTick.current = false;
      return;
    }
    if (!editingRef.current) void load({ silent: true });
  }, [refreshTick, load]);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      // Render what actually landed on disk — the backend enforces a hard
      // size cap, so the stored content can differ from the draft.
      const r = await writeMemoryFile(meta.name, draft);
      setContent(r.content);
      setDraft(r.content);
      setEditing(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await resetMemoryFile(meta.name);
      setContent(r.content);
      setDraft(r.content);
      setEditing(false);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    setDraft(content ?? '');
    setEditing(false);
    setError(null); // a stale "Failed to save" banner shouldn't outlive the edit
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/60">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[11px] text-muted-foreground truncate">{meta.name}</span>
          <span className="text-[10px] text-muted-foreground shrink-0">{fmtSize(meta.size)}</span>
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-full border border-border/60 text-muted-foreground shrink-0"
            title={
              meta.agent_writable
                ? 'The agent updates this file as it learns; you can edit it too.'
                : 'Human-only — the agent reads this but never edits it.'
            }
          >
            {meta.agent_writable ? 'agent + you' : 'human-only'}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {editing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[10px] gap-1 border-border/60 text-foreground/70 hover:text-foreground"
                onClick={cancel}
                disabled={busy}
              >
                <X className="w-3 h-3" />
                Cancel
              </Button>
              <Button size="sm" className="h-6 px-2 text-[10px] gap-1" onClick={() => void save()} disabled={busy}>
                {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save
              </Button>
            </>
          ) : (
            <>
              {meta.has_default && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[10px] gap-1 border-border/60 text-foreground/70 hover:text-foreground"
                      disabled={busy || content === null}
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset {meta.name} to its default?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This replaces the current content with the shipped template. Everything the
                        agent (or you) wrote in this file will be lost.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep current</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void reset()}>Reset</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10px] gap-1 border-border/60 text-foreground/70 hover:text-foreground"
                onClick={() => setEditing(true)}
                disabled={content === null}
              >
                <Edit3 className="w-3 h-3" />
                Edit
              </Button>
            </>
          )}
        </div>
      </div>

      {error && (
        <p className="px-3 py-1.5 text-[11px] text-red-400 border-b border-border/60">{error}</p>
      )}

      <div className="flex-1 overflow-auto">
        {content === null && error ? (
          /* Read failed — don't render the "Empty" placeholder as if the file
             had loaded; offer a retry instead. */
          <div className="h-full flex flex-col items-center justify-center gap-2 text-center px-6">
            <p className="text-[12px] text-muted-foreground">Couldn't load {meta.name}.</p>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px] gap-1 border-border/60 text-foreground/70 hover:text-foreground"
              onClick={() => void load()}
            >
              <RefreshCw className="w-3 h-3" />
              Retry
            </Button>
          </div>
        ) : content === null ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : editing ? (
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className={cn(
              'w-full h-full min-h-[400px] rounded-none border-0 resize-none',
              'font-mono text-[12px] leading-relaxed text-foreground bg-transparent',
              'focus-visible:ring-0'
            )}
          />
        ) : (
          <div className="prose-agent px-4 py-3 text-[13px] text-foreground">
            <ReactMarkdown>
              {content || '_Empty — the agent will fill this in as it learns._'}
            </ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
};
