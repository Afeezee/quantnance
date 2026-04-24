import { useState, useEffect, useMemo, useRef } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { SignedIn, useUser, useClerk } from '@clerk/clerk-react';
import Background from './components/layout/Background';
import Navbar from './components/layout/Navbar';
import SearchBar from './components/search/SearchBar';
import LoadingProgress from './components/shared/LoadingProgress';
import AssetOverviewCard from './components/brief/AssetOverviewCard';
import NewsSentimentSection from './components/brief/NewsSentimentSection';
import BayseSection from './components/brief/BayseSection';
import FinancialMetricsPanel from './components/brief/FinancialMetricsPanel';
import RiskAssessmentCard from './components/brief/RiskAssessmentCard';
import MacroContextCard from './components/brief/MacroContextCard';
import PlainLanguageSummary from './components/brief/PlainLanguageSummary';
import ChatInterface from './components/brief/ChatInterface';
import ComparisonView from './components/brief/ComparisonView';
import RecommendationView from './components/brief/RecommendationView';
import ResearchPage from './pages/ResearchPage';
import QuantDocsPage from './pages/QuantDocsPage';
import { useBrief } from './hooks/useBrief';
import { useSearchHistory, type HistoryEntry } from './hooks/useSearchHistory';
import { Clock, Trash2, ArrowRight, X, Printer } from 'lucide-react';

function HeroSection() {
  return (
    <div
      className="animate-fade-in-up"
      style={{
        textAlign: 'center',
        paddingTop: 80,
        paddingBottom: 48,
      }}
    >
      <h1
        style={{
          fontSize: 56,
          fontWeight: 700,
          letterSpacing: '-0.03em',
          marginBottom: 12,
          position: 'relative',
          display: 'inline-block',
        }}
      >
        <span className="text-gradient">Quantnance</span>
        <span
          style={{
            position: 'absolute',
            bottom: -4,
            left: '10%',
            right: '10%',
            height: 3,
            borderRadius: 2,
            background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-teal))',
            opacity: 0.6,
          }}
        />
      </h1>
      <p
        className="animate-fade-in-up delay-100"
        style={{ fontSize: 18, color: 'var(--text-secondary)', marginBottom: 8 }}
      >
        Finance, quantified and clarified.
      </p>
      <p
        className="animate-fade-in-up delay-200"
        style={{ fontSize: 14, color: 'var(--text-muted)' }}
      >
        AI-powered investment intelligence for every investor.
      </p>
    </div>
  );
}

function ResultExportBar({ label }: { label: string }) {
  return (
    <div
      className="result-actions no-print"
      style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <button
        type="button"
        onClick={() => window.print()}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          borderRadius: 10,
          border: '1px solid var(--card-border)',
          background: 'var(--card-bg)',
          color: 'var(--text-primary)',
          padding: '8px 12px',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          fontFamily: 'var(--font-sans)',
        }}
        title={`Export ${label} as PDF`}
      >
        <Printer size={14} /> Export PDF
      </button>
    </div>
  );
}

function formatTimeLabel(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function HistorySidebar({ open, history, onSelect, onClear, onClose }: {
  open: boolean;
  history: HistoryEntry[];
  onSelect: (prompt: string, mode: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState('');

  const labels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const entry of history) {
      map[entry.id] = formatTimeLabel(entry.timestamp);
    }
    return map;
  }, [history]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return history;
    const q = filter.toLowerCase();
    return history.filter((e) => (e.displayPrompt ?? e.prompt).toLowerCase().includes(q));
  }, [history, filter]);

  const modeLabel = (mode: string) => {
    switch (mode) {
      case 'compare': return { icon: '⇄', text: 'Compare' };
      case 'recommend': return { icon: '★', text: 'Recommend' };
      case 'research': return { icon: '💬', text: 'AI Research' };
      case 'quantdocs': return { icon: '📄', text: 'QuantDocs' };
      default: return { icon: '◎', text: 'Analyze' };
    }
  };

  return (
    <>
      {/* Backdrop */}
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

      {/* Sidebar */}
      <aside
        className="sidebar-panel"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 320,
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
        <div style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid var(--card-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-teal))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 14,
              color: '#fff',
            }}>Q</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
                Quantnance <span style={{ color: 'var(--accent-blue)', fontStyle: 'italic' }}>AI</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Search History</div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 6,
              display: 'flex',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)'; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Search filter */}
        {history.length > 0 && (
          <div style={{ padding: '12px 16px 0' }}>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search history..."
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
              onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = 'var(--input-focus-border)'; }}
              onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = 'var(--input-border)'; }}
            />
          </div>
        )}

        {/* History List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px' }}>
          {history.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'var(--text-muted)',
              fontSize: 13,
            }}>
              <Clock size={24} style={{ marginBottom: 8, opacity: 0.4 }} />
              <p>No recent searches yet.</p>
              <p style={{ fontSize: 12, marginTop: 4 }}>Your search history will appear here.</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: 'var(--text-muted)',
              fontSize: 13,
            }}>
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
                      <div style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontSize: 13,
                        color: 'var(--text-primary)',
                      }}>
                        {entry.displayPrompt ?? entry.prompt}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        {text} · {labels[entry.id] ?? ''}
                      </div>
                    </div>
                    <ArrowRight size={12} style={{ opacity: 0.3, flexShrink: 0 }} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Clear button */}
        {history.length > 0 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--card-border)' }}>
            <button
              onClick={onClear}
              style={{
                width: '100%',
                background: 'none',
                border: '1px solid var(--card-border)',
                borderRadius: 10,
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: 12,
                padding: '8px 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--danger)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--danger)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--card-border)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
              }}
            >
              <Trash2 size={12} /> Clear History
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

function HomePage() {
  const navigate = useNavigate();
  const [pendingPrompt, setPendingPrompt] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { brief, comparison, recommendations, mode, loading, error, analyze, reset } = useBrief();
  const { history, addEntry, clearHistory } = useSearchHistory();
  const { isSignedIn } = useUser();
  const { openSignIn } = useClerk();
  const verdictRef = useRef<HTMLDivElement>(null);

  const hasResult = (brief != null || comparison != null || recommendations != null) && !loading;

  useEffect(() => {
    if (hasResult) {
      // Small delay to let the DOM render the verdict card, then scroll to it
      requestAnimationFrame(() => {
        if (verdictRef.current) {
          verdictRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      });
    }
  }, [hasResult]);

  // Record to history when results arrive
  useEffect(() => {
    if (hasResult && pendingPrompt && mode !== 'idle') {
      addEntry(pendingPrompt, mode as 'analyze' | 'compare' | 'recommend');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasResult]);

  // Smart fallback: when error occurs, redirect to research chat
  useEffect(() => {
    if (error && !loading && pendingPrompt) {
      const isSearchFailure = error.toLowerCase().includes('could not find') ||
        error.toLowerCase().includes('no results') ||
        error.toLowerCase().includes('not found') ||
        error.toLowerCase().includes('search failed');
      if (isSearchFailure) {
        const params = new URLSearchParams({
          q: pendingPrompt,
          context: `I couldn't find a stock matching "${pendingPrompt}". Let me help you research this instead.`,
        });
        navigate(`/research?${params.toString()}`);
      }
    }
  }, [error, loading, pendingPrompt, navigate]);

  const handlePrompt = (prompt: string) => {
    if (!isSignedIn) {
      openSignIn();
      return;
    }
    setPendingPrompt(prompt);
    analyze(prompt);
  };

  const handleHistorySelect = (prompt: string, historyMode: string) => {
    if (historyMode === 'research') {
      navigate(`/research?q=${encodeURIComponent(prompt)}`);
    } else if (historyMode === 'quantdocs') {
      navigate(prompt.trim() ? `/quantdocs?question=${encodeURIComponent(prompt)}` : '/quantdocs');
    } else {
      handlePrompt(prompt);
    }
  };

  const handleGoHome = () => {
    setPendingPrompt('');
    setSidebarOpen(false);
    reset();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <Background />
      <Navbar onToggleSidebar={() => setSidebarOpen((s) => !s)} onGoHome={handleGoHome} />
      <SignedIn>
        <HistorySidebar
          open={sidebarOpen}
          history={history}
          onSelect={handleHistorySelect}
          onClear={clearHistory}
          onClose={() => setSidebarOpen(false)}
        />
      </SignedIn>
      <main className="container">
        {!hasResult && !loading && !error && (
          <>
            <HeroSection />
            <div style={{ maxWidth: 640, margin: '0 auto' }}>
              <SearchBar onSubmit={handlePrompt} showChips />
            </div>
          </>
        )}

        {loading && (
          <>
            <div style={{ maxWidth: 640, margin: '16px auto 0' }}>
              <SearchBar compact onSubmit={handlePrompt} loading={loading} />
            </div>
            <LoadingProgress symbol={brief?.symbol || pendingPrompt} />
          </>
        )}

        {error && !loading && (
          <div
            className="glass-card animate-fade-in-up"
            style={{ maxWidth: 600, margin: '60px auto', padding: 32, textAlign: 'center' }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠</div>
            <h3 style={{ fontSize: 18, marginBottom: 8 }}>Something went wrong</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>{error}</p>
            <div style={{ maxWidth: 500, margin: '0 auto' }}>
              <SearchBar compact onSubmit={handlePrompt} />
            </div>
          </div>
        )}

        {/* ─── Recommendation View ─── */}
        {hasResult && mode === 'recommend' && recommendations && (
          <div className="brief-layout app-print-root">
            <ResultExportBar label="recommendations" />
            <div className="result-search no-print">
              <SearchBar compact onSubmit={handlePrompt} />
            </div>
            <RecommendationView
              data={recommendations.recommendations}
              onAnalyze={handlePrompt}
            />
          </div>
        )}

        {/* ─── Comparison View ─── */}
        {hasResult && mode === 'compare' && comparison && (
          <div className="brief-layout app-print-root">
            <ResultExportBar label="comparison" />
            <div className="result-search no-print">
              <SearchBar compact onSubmit={handlePrompt} />
            </div>
            <ComparisonView
              stocks={comparison.stocks}
              comparison={comparison.comparison}
              onAnalyze={handlePrompt}
            />
          </div>
        )}

        {/* ─── Single Stock Analysis ─── */}
        {hasResult && mode === 'analyze' && brief && (
          <div className="brief-layout app-print-root">
            <ResultExportBar label={brief.symbol || 'analysis'} />
            <div className="result-search no-print">
              <SearchBar compact onSubmit={handlePrompt} />
            </div>

            {/* AI Verdict first for top-down reading */}
            <div ref={verdictRef} className="animate-fade-in-up stagger-1">
              <PlainLanguageSummary brief={brief.brief} />
            </div>

            <div className="animate-fade-in-up stagger-2">
              <AssetOverviewCard
                quote={brief.quote}
                overview={brief.company_overview}
                priceHistory={brief.price_history}
              />
            </div>

            <div className="two-col-grid animate-fade-in-up stagger-3">
              <NewsSentimentSection
                sentiment={brief.sentiment}
                news={brief.news}
              />
              <BayseSection
                bayse={brief.bayse_sentiment}
                brief={brief.brief}
              />
            </div>

            <div className="animate-fade-in-up stagger-4">
              <FinancialMetricsPanel
                overview={brief.company_overview}
                brief={brief.brief}
              />
            </div>

            <div className="two-col-grid animate-fade-in-up stagger-5">
              <RiskAssessmentCard
                brief={brief.brief}
                volatility={brief.volatility}
              />
              <MacroContextCard brief={brief.brief} />
            </div>

            <div className="animate-fade-in-up stagger-6 no-print">
              <ChatInterface
                symbol={brief.symbol}
                briefContext={brief as unknown as Record<string, unknown>}
              />
            </div>
          </div>
        )}
      </main>
    </>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/research" element={<ResearchPage />} />
      <Route path="/quantdocs" element={<QuantDocsPage />} />
    </Routes>
  );
}
