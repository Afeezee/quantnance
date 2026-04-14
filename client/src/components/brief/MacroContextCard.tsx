import { useState } from 'react';
import type { BriefContent } from '../../hooks/useBrief';
import { useBayseSocket } from '../../hooks/useBayseSocket';
import GlassCard from '../shared/GlassCard';

interface MacroContextCardProps {
  brief: BriefContent | null;
}

function parseEnvironmentLevel(commentary: string, keyword: string): 'Low' | 'Medium' | 'High' {
  const lower = commentary.toLowerCase();
  const kw = keyword.toLowerCase();
  if (lower.includes(`high ${kw}`) || lower.includes(`${kw} high`) || lower.includes(`rising ${kw}`) || lower.includes(`elevated ${kw}`)) return 'High';
  if (lower.includes(`low ${kw}`) || lower.includes(`${kw} low`) || lower.includes(`declining ${kw}`) || lower.includes(`subdued ${kw}`)) return 'Low';
  return 'Medium';
}

const LEVEL_WIDTH: Record<string, number> = { Low: 30, Medium: 55, High: 85 };
const LEVEL_COLOR: Record<string, string> = { Low: '#10b981', Medium: '#f59e0b', High: '#ef4444' };

const CURRENCY_PAIRS = [
  { key: 'USDNGN', label: 'USD/NGN', flag: '🇺🇸', name: 'US Dollar' },
  { key: 'EURNGN', label: 'EUR/NGN', flag: '🇪🇺', name: 'Euro' },
  { key: 'GBPNGN', label: 'GBP/NGN', flag: '🇬🇧', name: 'British Pound' },
  { key: 'CADNGN', label: 'CAD/NGN', flag: '🇨🇦', name: 'Canadian Dollar' },
  { key: 'CHFNGN', label: 'CHF/NGN', flag: '🇨🇭', name: 'Swiss Franc' },
  { key: 'CNYNGN', label: 'CNY/NGN', flag: '🇨🇳', name: 'Chinese Yuan' },
  { key: 'JPYNGN', label: 'JPY/NGN', flag: '🇯🇵', name: 'Japanese Yen' },
  { key: 'AEDNGN', label: 'AED/NGN', flag: '🇦🇪', name: 'UAE Dirham' },
  { key: 'ZARNGN', label: 'ZAR/NGN', flag: '🇿🇦', name: 'South African Rand' },
];

export default function MacroContextCard({ brief }: MacroContextCardProps) {
  const { prices, connected } = useBayseSocket();
  const [selectedPair, setSelectedPair] = useState('USDNGN');

  const pair = CURRENCY_PAIRS.find((p) => p.key === selectedPair) ?? CURRENCY_PAIRS[0];
  const rate = prices[selectedPair]?.price;

  const commentary = brief?.macroeconomic_context?.commentary || '';
  const inflation = parseEnvironmentLevel(commentary, 'inflation');
  const interest = parseEnvironmentLevel(commentary, 'interest');
  const growth = parseEnvironmentLevel(commentary, 'growth');

  const indicators = [
    { label: 'Inflation', level: inflation },
    { label: 'Interest Rate', level: interest },
    { label: 'Growth', level: growth },
  ];

  return (
    <GlassCard
      title="Macro Context"
      icon={<span style={{ fontSize: 11 }}>🌍</span>}
      animationDelay={300}
    >
      {/* Currency pair selector + live rate */}
      <div
        style={{
          marginBottom: 20,
          padding: 12,
          borderRadius: 10,
          background: 'rgba(16,185,129,0.06)',
          border: '1px solid rgba(16,185,129,0.15)',
        }}
      >
        {/* Dropdown row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <select
            value={selectedPair}
            onChange={(e) => setSelectedPair(e.target.value)}
            style={{
              background: 'var(--card-bg-solid)',
              color: 'var(--text-primary)',
              border: '1px solid var(--input-border)',
              borderRadius: 8,
              padding: '6px 10px',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              outline: 'none',
              flex: 1,
            }}
          >
            {CURRENCY_PAIRS.map((p) => (
              <option key={p.key} value={p.key} style={{ background: 'var(--card-bg-solid)', color: 'var(--text-primary)' }}>
                {p.flag} {p.label} — {p.name}
              </option>
            ))}
          </select>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: connected ? 'var(--success)' : 'var(--danger)',
                animation: connected ? 'pulse-glow 2s infinite' : 'none',
              }}
              title={connected ? 'Live' : 'Offline'}
            />
            <span style={{ fontSize: 10, color: connected ? 'var(--success)' : 'var(--text-muted)' }}>
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Rate display */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{pair.flag} {pair.label}</span>
          <span className="font-mono" style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)' }}>
            ₦{rate != null ? rate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'}
          </span>
        </div>
      </div>

      {/* Commentary */}
      {commentary && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 16 }}>
          {commentary}
        </p>
      )}

      {/* Sector outlook */}
      {brief?.macroeconomic_context?.sector_outlook && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 20 }}>
          {brief.macroeconomic_context.sector_outlook}
        </p>
      )}

      {/* Environment indicators */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {indicators.map((ind) => (
          <div key={ind.label}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
              <span style={{ color: 'var(--text-muted)' }}>{ind.label}</span>
              <span style={{ color: LEVEL_COLOR[ind.level], fontWeight: 500 }}>{ind.level}</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)' }}>
              <div
                style={{
                  height: '100%',
                  borderRadius: 3,
                  width: `${LEVEL_WIDTH[ind.level]}%`,
                  background: LEVEL_COLOR[ind.level],
                  transition: 'width 0.8s ease-out',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
