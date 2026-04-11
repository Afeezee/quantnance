interface ExchangeSelectorProps {
  value: string;
  onChange: (val: string) => void;
}

const EXCHANGES = [
  { value: '', label: 'All Exchanges' },
  { value: 'NGX', label: 'NGX' },
  { value: 'NYSE', label: 'NYSE' },
  { value: 'NASDAQ', label: 'NASDAQ' },
  { value: 'LSE', label: 'LSE' },
  { value: 'CRYPTO', label: 'Crypto' },
];

export default function ExchangeSelector({ value, onChange }: ExchangeSelectorProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        background: 'var(--card-bg)',
        backdropFilter: 'blur(20px)',
        border: '1px solid var(--card-border)',
        borderRadius: 12,
        color: 'var(--text-primary)',
        padding: '12px 16px',
        fontSize: 14,
        fontFamily: 'var(--font-sans)',
        outline: 'none',
        cursor: 'pointer',
        minWidth: 130,
      }}
    >
      {EXCHANGES.map((ex) => (
        <option key={ex.value} value={ex.value} style={{ background: 'var(--bg-secondary)' }}>
          {ex.label}
        </option>
      ))}
    </select>
  );
}
