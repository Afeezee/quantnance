import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../shared/LoadingSpinner';
import { Search, Sparkles, ArrowLeftRight, TrendingUp, MessageSquare, FileSearch } from 'lucide-react';

type SearchMode = 'search' | 'research' | 'quantdocs';

const SEARCH_CHIPS = [
  { label: 'Tell me about Tesla stock', icon: Search },
  { label: 'Compare Microsoft to Apple stocks', icon: ArrowLeftRight },
  { label: 'Recommend top crypto stocks', icon: TrendingUp },
  { label: 'How is NVIDIA performing?', icon: Sparkles },
  { label: 'Compare Amazon to Google', icon: ArrowLeftRight },
];

const RESEARCH_CHIPS = [
  { label: 'Explain what a P/E ratio means', icon: Sparkles },
  { label: 'What is Dangote Cement?', icon: Search },
  { label: 'Risks of investing in emerging markets', icon: TrendingUp },
];

const QUANTDOCS_CHIPS = [
  { label: 'Assess this for investment risk', icon: Sparkles },
  { label: 'Extract the key financial metrics', icon: FileSearch },
  { label: 'Is this company financially healthy?', icon: TrendingUp },
];

interface SearchBarProps {
  compact?: boolean;
  onSubmit: (prompt: string) => void;
  loading?: boolean;
  showChips?: boolean;
}

export default function SearchBar({ compact = false, onSubmit, loading = false, showChips = false }: SearchBarProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('search');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!compact && inputRef.current) inputRef.current.focus();
  }, [compact]);

  const handleSubmit = () => {
    const trimmed = query.trim();
    if (loading) return;
    if (!trimmed && mode !== 'quantdocs') return;
    if (mode === 'research') {
      navigate(`/research?q=${encodeURIComponent(trimmed)}`);
    } else if (mode === 'quantdocs') {
      const target = trimmed ? `/quantdocs?question=${encodeURIComponent(trimmed)}` : '/quantdocs';
      navigate(target);
    } else {
      onSubmit(trimmed);
    }
  };

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const placeholders: Record<SearchMode, string> = {
    search: compact
      ? 'Ask about any stock...'
      : 'Ask about any investment — e.g. "How is Apple performing?" or "AAPL"',
    research: compact
      ? 'Ask anything about finance...'
      : 'Ask anything — e.g. "What is Dangote Cement?" or "Explain P/E ratios"',
    quantdocs: compact
      ? 'Upload and analyse a financial document...'
      : 'Set an optional analysis question before opening QuantDocs...',
  };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: compact ? '100%' : 640,
        margin: compact ? 0 : '0 auto',
      }}
    >
      {/* Mode selector — only on landing / non-compact */}
      {!compact && (
        <div
          style={{
            display: 'flex',
            gap: 4,
            marginBottom: 10,
            padding: 3,
            background: 'var(--input-bg)',
            borderRadius: 10,
            border: '1px solid var(--input-border)',
            width: 'fit-content',
          }}
        >
          <button
            onClick={() => setMode('search')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 8,
              border: 'none',
              background: mode === 'search' ? 'var(--accent-blue)' : 'transparent',
              color: mode === 'search' ? '#fff' : 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <Search size={13} />
            Stock Analysis
          </button>
          <button
            onClick={() => setMode('research')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 8,
              border: 'none',
              background: mode === 'research'
                ? 'linear-gradient(135deg, var(--accent-blue), var(--accent-teal))'
                : 'transparent',
              color: mode === 'research' ? '#fff' : 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <MessageSquare size={13} />
            AI Research
          </button>
          <button
            onClick={() => setMode('quantdocs')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 8,
              border: 'none',
              background: mode === 'quantdocs'
                ? 'linear-gradient(135deg, var(--accent-blue), var(--accent-teal))'
                : 'transparent',
              color: mode === 'quantdocs' ? '#fff' : 'var(--text-secondary)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'var(--font-sans)',
            }}
          >
            <FileSearch size={13} />
            QuantDocs
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder={compact ? placeholders.search : placeholders[mode]}
            style={{
              width: '100%',
              background: 'var(--input-bg)',
              backdropFilter: 'blur(20px)',
              border: '1px solid var(--input-border)',
              borderRadius: 12,
              color: 'var(--text-primary)',
              padding: compact ? '10px 40px 10px 16px' : '16px 48px 16px 20px',
              fontSize: compact ? 14 : 16,
              fontFamily: 'var(--font-sans)',
              outline: 'none',
              transition: 'border-color 0.3s ease, background 0.3s ease',
            }}
            onFocusCapture={(e) => {
              (e.target as HTMLInputElement).style.borderColor = 'var(--input-focus-border)';
            }}
            onBlurCapture={(e) => {
              (e.target as HTMLInputElement).style.borderColor = 'var(--input-border)';
            }}
          />
          {loading && (
            <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)' }}>
              <LoadingSpinner size={16} />
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || (!query.trim() && mode !== 'quantdocs')}
          style={{
            padding: compact ? '10px 18px' : '16px 24px',
            background: (!compact && mode === 'research')
              ? 'linear-gradient(135deg, var(--accent-blue), var(--accent-teal))'
              : (!compact && mode === 'quantdocs')
                ? 'linear-gradient(135deg, var(--accent-blue), var(--accent-teal))'
              : 'var(--accent-blue)',
            border: 'none',
            borderRadius: 12,
            color: '#fff',
            fontFamily: 'var(--font-sans)',
            fontSize: compact ? 14 : 15,
            fontWeight: 600,
            cursor: loading || (!query.trim() && mode !== 'quantdocs') ? 'not-allowed' : 'pointer',
            opacity: loading || (!query.trim() && mode !== 'quantdocs') ? 0.5 : 1,
            transition: 'opacity 0.2s ease, filter 0.2s ease',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            if (!loading && (query.trim() || mode === 'quantdocs')) {
              (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.15)';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1)';
          }}
        >
          {!compact && mode === 'research' ? 'Ask AI' : (!compact && mode === 'quantdocs' ? 'Open QuantDocs' : 'Analyze')}
        </button>
      </div>

      {/* Suggestion Chips */}
      {showChips && (
        <div
          className="animate-fade-in-up delay-300"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginTop: 16,
            justifyContent: 'center',
          }}
        >
          {(mode === 'search' ? SEARCH_CHIPS : mode === 'research' ? RESEARCH_CHIPS : QUANTDOCS_CHIPS).map((chip) => {
            const Icon = chip.icon;
            return (
              <button
                key={chip.label}
                className="search-chip"
                onClick={() => {
                  if (mode === 'research') {
                    navigate(`/research?q=${encodeURIComponent(chip.label)}`);
                  } else if (mode === 'quantdocs') {
                    navigate(`/quantdocs?question=${encodeURIComponent(chip.label)}`);
                  } else {
                    setQuery(chip.label);
                    onSubmit(chip.label);
                  }
                }}
              >
                <Icon size={13} />
                {chip.label}
              </button>
            );
          })}
          {/* AI Research chip — always visible in search mode */}
          {mode === 'search' && (
            <button
              className="search-chip"
              onClick={() => setMode('research')}
              style={{
                background: 'rgba(59,130,246,0.12)',
                borderColor: 'rgba(59,130,246,0.3)',
              }}
            >
              <MessageSquare size={13} />
              AI Research Chat
            </button>
          )}
        </div>
      )}
    </div>
  );
}
