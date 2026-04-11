import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import LoadingSpinner from '../shared/LoadingSpinner';

interface SearchBarProps {
  compact?: boolean;
  onSubmit: (prompt: string) => void;
  loading?: boolean;
}

export default function SearchBar({ compact = false, onSubmit, loading = false }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!compact && inputRef.current) inputRef.current.focus();
  }, [compact]);

  const handleSubmit = () => {
    const trimmed = query.trim();
    if (!trimmed || loading) return;
    onSubmit(trimmed);
  };

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
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
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder={compact
              ? 'Ask about any stock...'
              : 'Ask about any investment — e.g. "How is Apple performing?" or "AAPL"'}
            style={{
              width: '100%',
              background: 'var(--card-bg)',
              backdropFilter: 'blur(20px)',
              border: '1px solid var(--card-border)',
              borderRadius: 12,
              color: 'var(--text-primary)',
              padding: compact ? '10px 40px 10px 16px' : '16px 48px 16px 20px',
              fontSize: compact ? 14 : 16,
              fontFamily: 'var(--font-sans)',
              outline: 'none',
              transition: 'border-color 0.3s ease',
            }}
            onFocusCapture={(e) => {
              (e.target as HTMLInputElement).style.borderColor = 'rgba(59,130,246,0.5)';
            }}
            onBlurCapture={(e) => {
              (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.08)';
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
          disabled={loading || !query.trim()}
          style={{
            padding: compact ? '10px 18px' : '16px 24px',
            background: 'rgba(59,130,246,0.85)',
            border: '1px solid rgba(59,130,246,0.4)',
            borderRadius: 12,
            color: '#fff',
            fontFamily: 'var(--font-sans)',
            fontSize: compact ? 14 : 15,
            fontWeight: 600,
            cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !query.trim() ? 0.5 : 1,
            transition: 'opacity 0.2s ease, background 0.2s ease',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            if (!loading && query.trim()) {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(59,130,246,1)';
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(59,130,246,0.85)';
          }}
        >
          Analyze
        </button>
      </div>
    </div>
  );
}
