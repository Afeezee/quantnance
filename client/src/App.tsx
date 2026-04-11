import { useState, useRef, useEffect } from 'react';
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
import { useBrief } from './hooks/useBrief';

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
            background: 'linear-gradient(90deg, var(--accent-blue), var(--accent-violet))',
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

export default function App() {
  const [pendingPrompt, setPendingPrompt] = useState('');
  const { brief, loading, error, analyze } = useBrief();
  const briefRef = useRef<HTMLDivElement>(null);

  const briefLoaded = brief != null && !loading;

  useEffect(() => {
    if (briefLoaded && briefRef.current) {
      briefRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [briefLoaded]);

  const handlePrompt = (prompt: string) => {
    setPendingPrompt(prompt);
    analyze(prompt);
  };

  return (
    <>
      <Background />
      <Navbar />
      <main className="container">
        {!briefLoaded && !loading && (
          <>
            <HeroSection />
            <div style={{ maxWidth: 640, margin: '0 auto' }}>
              <SearchBar
                onSubmit={handlePrompt}
              />
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
            style={{
              maxWidth: 600,
              margin: '60px auto',
              padding: 32,
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>⚠</div>
            <h3 style={{ fontSize: 18, marginBottom: 8 }}>Something went wrong</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 16 }}>{error}</p>
            <div style={{ maxWidth: 500, margin: '0 auto' }}>
              <SearchBar
                compact
                onSubmit={handlePrompt}
              />
            </div>
          </div>
        )}

        {briefLoaded && (
          <div className="brief-layout">
            <SearchBar
              compact
              onSubmit={handlePrompt}
            />

            <div ref={briefRef} />
            <AssetOverviewCard
              quote={brief.quote}
              overview={brief.company_overview}
              priceHistory={brief.price_history}
            />

            <div className="two-col-grid">
              <NewsSentimentSection
                sentiment={brief.sentiment}
                news={brief.news}
              />
              <BayseSection
                bayse={brief.bayse_sentiment}
                brief={brief.brief}
              />
            </div>

            <FinancialMetricsPanel
              overview={brief.company_overview}
              brief={brief.brief}
            />

            <div className="two-col-grid">
              <RiskAssessmentCard
                brief={brief.brief}
                volatility={brief.volatility}
              />
              <MacroContextCard brief={brief.brief} />
            </div>

            <PlainLanguageSummary brief={brief.brief} />

            <ChatInterface
              symbol={brief.symbol}
              briefContext={brief as unknown as Record<string, unknown>}
            />
          </div>
        )}
      </main>
    </>
  );
}
