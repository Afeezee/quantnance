import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Clock, Trash2, ArrowRight, X, Search, MessageSquare, FileText } from 'lucide-react';
import BrandMark from '../shared/BrandMark';
import type { HistoryEntry } from '../../hooks/useSearchHistory';

type FeatureKey = 'analyze' | 'research' | 'quantdocs';

const FEATURES: Array<{
  key: FeatureKey;
  label: string;
  path: string;
  icon: typeof Search;
  description: string;
}> = [
  {
    key: 'analyze',
    label: 'Stock Analysis',
    path: '/',
    icon: Search,
    description: 'Analyze tickers, compare, or get recommendations',
  },
  {
    key: 'research',
    label: 'AI Research',
    path: '/research',
    icon: MessageSquare,
    description: 'Open-ended financial research chat',
  },
  {
    key: 'quantdocs',
    label: 'QuantDocs',
    path: '/quantdocs',
    icon: FileText,
    description: 'Upload a document and ask questions',
  },
];

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

export interface AppSidebarProps {
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
}

/**
 * Unified left-drawer sidebar used across Home, Research and QuantDocs.
 * Top: feature nav (Analyze / Research / QuantDocs) so every entry point is
 * one click away from any page. Bottom: shared search history with filter
 * and pagination.
 */
export default function AppSidebar({
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
}: AppSidebarProps) {
  const [filter, setFilter] = useState('');
  const navigate = useNavigate();
  const location = useLocation();

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

  const goTo = (path: string) => {
    if (location.pathname !== path) navigate(path);
    onClose();
  };

  return (
    <>
      {open && (
        <div
          className="sidebar-backdrop"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(2px)',
            transition: 'opacity 0.3s ease',
          }}
          onClick={onClose}
        />
      )}

      <aside
        className="sidebar-panel"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 'min(320px, 90vw)',
          zIndex: 70,
          background: 'var(--card-bg-solid)',
          borderRight: '1px solid var(--card-border)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          transform: open ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 20px 14px',
            borderBottom: '1px solid var(--card-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BrandMark size={30} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>
                Quantnance <span style={{ color: 'var(--accent-blue)', fontStyle: 'italic' }}>AI</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Features & history</div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close sidebar"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6,
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Features nav */}
        <div
          style={{
            padding: '12px 10px 6px',
            borderBottom: '1px solid var(--card-border)',
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              padding: '0 10px 6px',
            }}
          >
            Features
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {FEATURES.map((f) => {
              const isActive = location.pathname === f.path;
              const Icon = f.icon;
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => goTo(f.path)}
                  className="sidebar-feature-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: isActive ? 'rgba(59,130,246,0.12)' : 'transparent',
                    border: '1px solid transparent',
                    borderColor: isActive ? 'rgba(59,130,246,0.25)' : 'transparent',
                    color: isActive ? 'var(--accent-blue)' : 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: 13.5,
                    fontWeight: 600,
                    fontFamily: 'var(--font-sans)',
                    textAlign: 'left',
                    transition: 'background 0.2s, color 0.2s, border-color 0.2s',
                  }}
                >
                  <Icon size={16} style={{ flexShrink: 0 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span>{f.label}</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 400,
                        color: 'var(--text-muted)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {f.description}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* History filter */}
        {history.length > 0 && (
          <div style={{ padding: '12px 16px 0' }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'var(--text-muted)',
                marginBottom: 8,
              }}
            >
              Search history
            </div>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter history..."
              style={{
                width: '100%',
                background: 'var(--input-bg)',
                border: '1px solid var(--input-border)',
                borderRadius: 8,
                color: 'var(--text-primary)',
                padding: '8px 12px',
                fontSize: 13,
                fontFamily: 'var(--font-sans)',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
            />
          </div>
        )}

        {/* History List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
              <Clock size={24} style={{ marginBottom: 8, opacity: 0.4 }} />
              <p>Loading history...</p>
            </div>
          ) : history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
              <Clock size={24} style={{ marginBottom: 8, opacity: 0.4 }} />
              <p>No recent searches yet.</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Pick a feature above to get started.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
              <p>No matches found.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {filtered.map((entry) => {
                const { icon, text } = modeLabel(entry.mode);
                return (
                  <div
                    key={entry.id}
                    className="history-item"
                    onClick={() => { onSelect(entry.prompt, entry.mode); onClose(); }}
                  >
                    <span style={{ fontSize: 14, opacity: 0.6, flexShrink: 0 }}>{icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, color: 'var(--text-primary)' }}>
                        {entry.displayPrompt ?? entry.prompt}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {text} · {labels[entry.id] ?? ''}
                      </div>
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
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: pendingDeleteIds.has(entry.id) ? 'default' : 'pointer',
                          padding: 4,
                          borderRadius: 6,
                          display: 'flex',
                          opacity: pendingDeleteIds.has(entry.id) ? 0.4 : 0.7,
                        }}
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
                  style={{
                    marginTop: 10,
                    background: 'none',
                    border: '1px solid var(--card-border)',
                    borderRadius: 10,
                    color: 'var(--text-secondary)',
                    cursor: loadingMore ? 'default' : 'pointer',
                    fontSize: 12,
                    padding: '8px 10px',
                  }}
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
