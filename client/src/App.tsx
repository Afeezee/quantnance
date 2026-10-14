import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { SignedIn, useUser, useClerk } from '@clerk/clerk-react';
import Background from './components/layout/Background';
import Navbar from './components/layout/Navbar';
import AppSidebar from './components/layout/AppSidebar';
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
import ApiDebugBanner from './components/shared/ApiDebugBanner';
import ResearchPage from './pages/ResearchPage';
import QuantDocsPage from './pages/QuantDocsPage';
import { useBrief } from './hooks/useBrief';
import { useSearchHistory } from './hooks/useSearchHistory';
import { Printer } from 'lucide-react';

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

function HomePage() {
  const navigate = useNavigate();
  const [pendingPrompt, setPendingPrompt] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { brief, comparison, recommendations, mode, loading, error, analyze, reset } = useBrief();
  const { history, loading: historyLoading, loadingMore, hasMore, pendingDeleteIds, addEntry, deleteEntry, loadMore } = useSearchHistory();
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
      void addEntry(pendingPrompt, mode as 'analyze' | 'compare' | 'recommend');
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
      <ApiDebugBanner />
      <SignedIn>
        <AppSidebar
          open={sidebarOpen}
          history={history}
          loading={historyLoading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          pendingDeleteIds={pendingDeleteIds}
          onSelect={handleHistorySelect}
          onDelete={deleteEntry}
          onLoadMore={loadMore}
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
