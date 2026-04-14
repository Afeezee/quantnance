import { useState, useRef, useEffect, type FormEvent } from 'react';
import { useAuth } from '@clerk/clerk-react';
import axios from 'axios';
import GlassCard from '../shared/GlassCard';

const API_URL = import.meta.env.VITE_API_URL ?? '';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ChatInterfaceProps {
  symbol: string;
  briefContext: Record<string, unknown> | null;
}

const STARTERS = [
  'What does the P/E ratio tell me?',
  'How reliable is the Bayse crowd data?',
  'What are the main risks for a Nigerian investor?',
  'How does this compare to similar assets?',
];

export default function ChatInterface({ symbol, briefContext }: ChatInterfaceProps) {
  const { getToken } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Build a compact context to avoid 413 Payload Too Large from Groq
  const compactContext = (() => {
    if (!briefContext) return {};
    const b = briefContext as Record<string, unknown>;
    const ctx: Record<string, unknown> = {};
    if (b.symbol) ctx.symbol = b.symbol;
    if (b.exchange) ctx.exchange = b.exchange;
    if (b.quote) ctx.quote = b.quote;
    if (b.company_overview) ctx.company_overview = b.company_overview;
    if (b.volatility) ctx.volatility = b.volatility;
    if (b.brief) ctx.brief = b.brief;
    if (b.sentiment) ctx.sentiment = b.sentiment;
    if (b.bayse_sentiment) ctx.bayse_sentiment = b.bayse_sentiment;
    // Omit price_history and full news array — too large
    return ctx;
  })();

  const send = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const token = await getToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const { data } = await axios.post(`${API_URL}/api/chat`, {
        symbol,
        brief_context: compactContext,
        conversation_history: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        user_message: text.trim(),
      }, { headers, timeout: 60000 });
      setMessages((prev) => [...prev, { role: 'assistant', content: data.response }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: "I'm sorry, I couldn't process that. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <GlassCard
      title="Ask Quantnance AI"
      icon={<span style={{ fontSize: 11 }}>💬</span>}
      animationDelay={500}
    >
      {/* Starter chips */}
      {messages.length === 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {STARTERS.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              style={{
                background: 'rgba(59,130,246,0.08)',
                border: '1px solid rgba(59,130,246,0.2)',
                borderRadius: 20,
                color: 'var(--accent-blue)',
                fontSize: 12,
                padding: '6px 14px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.15)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(59,130,246,0.08)';
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              gap: 8,
            }}
          >
            {m.role === 'assistant' && (
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-violet))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#fff',
                  flexShrink: 0,
                }}
              >
                Q
              </div>
            )}
            <div
              style={{
                maxWidth: '75%',
                padding: '10px 16px',
                borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: m.role === 'user' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${m.role === 'user' ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.06)'}`,
                fontSize: 13,
                lineHeight: 1.6,
                color: 'var(--text-primary)',
              }}
            >
              {m.content}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-violet))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                color: '#fff',
                flexShrink: 0,
              }}
            >
              Q
            </div>
            <div
              style={{
                padding: '12px 20px',
                borderRadius: '16px 16px 16px 4px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                display: 'flex',
                gap: 4,
              }}
            >
              {[0, 1, 2].map((n) => (
                <span
                  key={n}
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--text-muted)',
                    animation: `bounce-dot 1.2s ease-in-out ${n * 0.15}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a question about this asset..."
          disabled={loading}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--card-border)',
            borderRadius: 12,
            color: 'var(--text-primary)',
            padding: '12px 16px',
            fontSize: 14,
            fontFamily: 'var(--font-sans)',
            outline: 'none',
            transition: 'border-color 0.3s ease',
          }}
          onFocus={(e) => { (e.target as HTMLInputElement).style.borderColor = 'rgba(59,130,246,0.5)'; }}
          onBlur={(e) => { (e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          style={{
            background: 'var(--accent-blue)',
            border: 'none',
            borderRadius: 12,
            color: '#fff',
            padding: '12px 20px',
            fontSize: 14,
            fontWeight: 600,
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !input.trim() ? 0.5 : 1,
            transition: 'opacity 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>Send</span>
          <span style={{ fontSize: 16 }}>➤</span>
        </button>
      </form>
    </GlassCard>
  );
}
