import { useState, useEffect, useMemo } from 'react';
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
import { useBrief } from './hooks/useBrief';
import { useSearchHistory, type HistoryEntry } from './hooks/useSearchHistory';
import { Clock, Trash2, ArrowRight, X } from 'lucide-react';

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
  onSelect: (prompt: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const labels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const entry of history) {
      map[entry.id] = formatTimeLabel(entry.timestamp);
    }
    return map;
  }, [history]);

  const modeLabel = (mode: string) => {
    switch (mode) {
      case 'compare': return { icon: '⇄', text: 'Compare' };
      case 'recommend': return { icon: '★', text: 'Recommend' };
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
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {history.map((entry) => {
                const { icon, text } = modeLabel(entry.mode);
                return (
                  <div
                    key={entry.id}
                    className="history-item"
                    onClick={() => { onSelect(entry.prompt); onClose(); }}
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
                        {entry.prompt}
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

export default function App() {
  const [pendingPrompt, setPendingPrompt] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { brief, comparison, recommendations, mode, loading, error, analyze } = useBrief();
  const { history, addEntry, clearHistory } = useSearchHistory();
  const { isSignedIn } = useUser();
  const { openSignIn } = useClerk();

  const hasResult = (brief != null || comparison != null || recommendations != null) && !loading;

  useEffect(() => {
    if (hasResult) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [hasResult]);

  // Record to history when results arrive
  useEffect(() => {
    if (hasResult && pendingPrompt && mode !== 'idle') {
      addEntry(pendingPrompt, mode as 'analyze' | 'compare' | 'recommend');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasResult]);

  const handlePrompt = (prompt: string) => {
    if (!isSignedIn) {
      openSignIn();
      return;
    }
    setPendingPrompt(prompt);
    analyze(prompt);
  };

  return (
    <>
      <Background />
      <Navbar onToggleSidebar={() => setSidebarOpen((s) => !s)} />
      <SignedIn>
        <HistorySidebar
          open={sidebarOpen}
          history={history}
          onSelect={handlePrompt}
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
          <div className="brief-layout">
            <SearchBar compact onSubmit={handlePrompt} />
            <RecommendationView
              data={recommendations.recommendations}
              onAnalyze={handlePrompt}
            />
          </div>
        )}

        {/* ─── Comparison View ─── */}
        {hasResult && mode === 'compare' && comparison && (
          <div className="brief-layout">
            <SearchBar compact onSubmit={handlePrompt} />
            <ComparisonView
              stocks={comparison.stocks}
              comparison={comparison.comparison}
              onAnalyze={handlePrompt}
            />
          </div>
        )}

        {/* ─── Single Stock Analysis ─── */}
        {hasResult && mode === 'analyze' && brief && (
          <div className="brief-layout">
            <SearchBar compact onSubmit={handlePrompt} />

            {/* AI Verdict first for top-down reading */}
            <div className="animate-fade-in-up stagger-1">
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

            <div className="animate-fade-in-up stagger-6">
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
