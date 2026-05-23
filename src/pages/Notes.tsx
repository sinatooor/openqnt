/**
 * Notes — list of all user notes captured on Avanza, with search.
 * Each note's instrument links to /stock/:orderbookId.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { StickyNote, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { PAGE_CONTENT_CLASS } from '@/components/PageHeader';
import { avanzaApi } from '@/integrations/avanza/api';

interface NoteItem {
  orderbookId?: string;
  id?: string;
  name?: string;
  instrumentName?: string;
  note?: string;
  preview?: string;
  flagCode?: string;
  modified?: string;
}

export default function Notes() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    avanzaApi
      .notesAll(query || undefined)
      .then((d) => {
        if (cancelled) return;
        // Avanza response shape varies; normalize to a flat array
        const list = Array.isArray(d) ? d : (d as { items?: NoteItem[] })?.items ?? [];
        setItems(list as NoteItem[]);
      })
      .catch((e: unknown) => !cancelled && setError((e as Error).message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [query]);

  const sorted = useMemo(() => items.slice(), [items]);

  return (
    <div className={`${PAGE_CONTENT_CLASS} space-y-4`}>
      <div className="flex items-center gap-2 mb-2">
        <StickyNote className="w-5 h-5 text-orange-400" />
        <h1 className="text-xl font-semibold text-foreground">Notes</h1>
        <span className="text-[11px] text-muted-foreground ml-2">From Avanza</span>
      </div>

      <Card className="bg-card/60 backdrop-blur-sm border-border/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs text-foreground/80 flex items-center gap-2">
            <Search className="w-3.5 h-3.5" />
            Search notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="Type to filter notes — empty for all"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="text-sm"
          />
        </CardContent>
      </Card>

      {error && (
        <div className="text-xs text-red-400 py-2 px-3 rounded bg-red-500/5 border border-red-500/20">
          {error}
        </div>
      )}

      <Card className="bg-card/60 backdrop-blur-sm border-border/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs text-foreground/80">
            {loading ? 'Loading…' : `${sorted.length} note${sorted.length === 1 ? '' : 's'}`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 && !loading ? (
            <div className="text-xs text-muted-foreground py-8 text-center">
              No notes found. Add notes on individual stocks in the Avanza web app — they sync here.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {sorted.map((n) => {
                const obId = String(n.orderbookId ?? n.id ?? '');
                const title = n.instrumentName ?? n.name ?? obId;
                const preview = n.preview ?? n.note ?? '';
                return (
                  <button
                    key={obId}
                    onClick={() => obId && navigate(`/stock/${obId}`)}
                    className="text-left p-3 rounded bg-muted/20 border border-border/30 hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        {n.flagCode && (
                          <span className="text-[9px] uppercase text-muted-foreground">{n.flagCode}</span>
                        )}
                        <span className="text-xs font-medium text-foreground truncate">{title}</span>
                      </div>
                      {n.modified && (
                        <span className="text-[10px] text-muted-foreground">{n.modified.slice(0, 10)}</span>
                      )}
                    </div>
                    {preview && (
                      <div className="text-[11px] text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                        {preview}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
