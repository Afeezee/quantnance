import { useEffect, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { SignedIn } from '@clerk/clerk-react';
import Background from '../components/layout/Background';
import Navbar from '../components/layout/Navbar';
import ResearchChat from '../components/research/ResearchChat';
import BrandMark from '../components/shared/BrandMark';
import { useSearchHistory, type HistoryEntry } from '../hooks/useSearchHistory';
import { Clock, Trash2, ArrowRight, X } from 'lucide-react';
import { useMemo } from 'react';

function formatTimeLabel(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function modeLabel(mode: string) {
  switch (mode) {
    case 'compare': return { icon: '⇄', text: 'Compare' };
    case 'recommend': return { icon: '★', text: 'Recommend' };
    case 'research': return { icon: '💬', text: 'AI Research' };
    case 'quantdocs': return { icon: '📄', text: 'QuantDocs' };
    default: return { icon: '◎', text: 'Analyze' };
  }
}

function ResearchSidebar({
  open,
  history,
  loading,
  loadingMore,
  hasMore,
  pendingDeleteIds,
  onSelect,
  onDelete,
  onLoadMore,
  onClose,
}: {
  open: boolean;
  history: HistoryEntry[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  pendingDeleteIds: ReadonlySet<string>;
  onSelect: (prompt: string, mode: string) => void;
  onDelete: (entryId: string) => void | Promise<void>;
  onLoadMore: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState('');

  const labels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const entry of history) map[entry.id] = formatTimeLabel(entry.timestamp);
    return map;
  }, [history]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return history;
    const q = filter.toLowerCase();
    return history.filter((e) => (e.displayPrompt ?? e.prompt).toLowerCase().includes(q));
  }, [history, filter]);

  return (
    <>
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }} onClick={onClose} />
      )}
      <aside style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, width: 320, zIndex: 70,
        background: 'var(--card-bg-solid)', borderRight: '1px solid var(--card-border)',
        backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--card-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BrandMark size={32} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>Quantnance <span style={{ color: 'var(--accent-blue)', fontStyle: 'italic' }}>AI</span></div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>History</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex' }}><X size={18} /></button>
        </div>
        {history.length > 0 && (
          <div style={{ padding: '12px 16px 0' }}>
            <input type="text" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search history..."
              style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 8, color: 'var(--text-primary)', padding: '8px 12px', fontSize: 13, fontFamily: 'var(--font-sans)', outline: 'none' }}
            />
          </div>
        )}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
              <Clock size={24} style={{ marginBottom: 8, opacity: 0.4 }} />
              <p>Loading history...</p>
            </div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
              <Clock size={24} style={{ marginBottom: 8, opacity: 0.4 }} />
              <p>No history yet.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}><p>No matches found.</p></div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {filtered.map((entry) => {
                const { icon, text } = modeLabel(entry.mode);
                return (
                  <div key={entry.id} className="history-item" onClick={() => { onSelect(entry.prompt, entry.mode); onClose(); }}>
                    <span style={{ fontSize: 14, opacity: 0.6, flexShrink: 0 }}>{icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, color: 'var(--text-primary)' }}>{entry.displayPrompt ?? entry.prompt}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{text} · {labels[entry.id] ?? ''}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <ArrowRight size={12} style={{ opacity: 0.3 }} />
                      <button
                        type="button"
                        aria-label="Delete history entry"
                        disabled={pendingDeleteIds.has(entry.id)}
                        onClick={(event) => {
                          event.stopPropagation();
                          void onDelete(entry.id);
                        }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: pendingDeleteIds.has(entry.id) ? 'default' : 'pointer', padding: 4, borderRadius: 6, display: 'flex', opacity: pendingDeleteIds.has(entry.id) ? 0.4 : 0.7 }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {!filter.trim() && hasMore && (
                <button
                  type="button"
                  onClick={() => { void onLoadMore(); }}
                  disabled={loadingMore}
                  style={{ marginTop: 10, background: 'none', border: '1px solid var(--card-border)', borderRadius: 10, color: 'var(--text-secondary)', cursor: loadingMore ? 'default' : 'pointer', fontSize: 12, padding: '8px 10px' }}
                >
                  {loadingMore ? 'Loading...' : 'Load older history'}
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export default function ResearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || undefined;
  const fallbackContext = searchParams.get('context') || undefined;
  const { history, loading, loadingMore, hasMore, pendingDeleteIds, addEntry, deleteEntry, loadMore } = useSearchHistory();
  const logged = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (initialQuery && !logged.current) {
      logged.current = true;
      void addEntry(initialQuery, 'research');
    }
  }, [initialQuery, addEntry]);

  const handleHistorySelect = (prompt: string, historyMode: string) => {
    if (historyMode === 'research') {
      navigate(`/research?q=${encodeURIComponent(prompt)}`);
    } else if (historyMode === 'quantdocs') {
      navigate(prompt.trim() ? `/quantdocs?question=${encodeURIComponent(prompt)}` : '/quantdocs');
    } else {
      navigate(`/?prompt=${encodeURIComponent(prompt)}`);
    }
  };

  return (
    <>
      <Background />
      <Navbar onToggleSidebar={() => setSidebarOpen((s) => !s)} />
      <SignedIn>
        <ResearchSidebar
          open={sidebarOpen}
          history={history}
          loading={loading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          pendingDeleteIds={pendingDeleteIds}
          onSelect={handleHistorySelect}
          onDelete={deleteEntry}
          onLoadMore={loadMore}
          onClose={() => setSidebarOpen(false)}
        />
      </SignedIn>
      <main>
        <ResearchChat
          initialMessage={initialQuery}
          initialContext={fallbackContext}
        />
      </main>
    </>
  );
}
