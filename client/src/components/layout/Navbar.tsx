import { useNavigate, useLocation } from 'react-router-dom';
import { useBayseSocket } from '../../hooks/useBayseSocket';
import { useTheme } from '../../hooks/useTheme';
import { useUser, UserButton, SignInButton, SignUpButton } from '@clerk/clerk-react';
import { Sun, Moon, Menu } from 'lucide-react';

const TICKER_ITEMS = [
  { symbol: 'BTC/USDT', key: 'BTCUSDT' },
  { symbol: 'ETH/USDT', key: 'ETHUSDT' },
  { symbol: 'SOL/USDT', key: 'SOLUSDT' },
  { symbol: 'USD/NGN', key: 'USDNGN' },
];

interface NavbarProps {
  onToggleSidebar?: () => void;
  onGoHome?: () => void;
}

export default function Navbar({ onToggleSidebar, onGoHome }: NavbarProps) {
  const { prices, connected } = useBayseSocket();
  const { theme, toggleTheme } = useTheme();
  const { isSignedIn } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  const handleHomeClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (location.pathname === '/' && onGoHome) {
      onGoHome();
      return;
    }
    navigate('/');
  };

  const renderTickerItem = (item: (typeof TICKER_ITEMS)[number], idx: number) => {
    const data = prices[item.key];
    const price = data?.price;
    const change = data?.change ?? 0;
    const isUp = change >= 0;

    return (
      <span
        key={`${item.key}-${idx}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 24px',
          whiteSpace: 'nowrap',
        }}
      >
        <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500 }}>
          {item.symbol}
        </span>
        <span
          className="font-mono"
          style={{ color: 'var(--accent-blue)', fontSize: 13, fontWeight: 500 }}
        >
          {price != null ? price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
        </span>
        <span style={{ color: isUp ? 'var(--success)' : 'var(--danger)', fontSize: 12 }}>
          {isUp ? '▲' : '▼'}
        </span>
      </span>
    );
  };

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        height: 64,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        background: 'var(--nav-bg)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--nav-border)',
        transition: 'background 0.4s ease, border-color 0.4s ease',
      }}
    >
      {/* Left section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        {/* Hamburger — toggles sidebar */}
        <button
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            width: 28,
            padding: 0,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
          onClick={onToggleSidebar}
          title="Toggle search history"
        >
          <Menu size={18} />
        </button>
        {/* Logo + title — navigates home */}
        <a
          href="/"
          onClick={handleHomeClick}
          style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', cursor: 'pointer' }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-teal))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 16,
            color: '#fff',
          }}
        >
          Q
        </div>
        <span style={{ fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>
          Quantnance
        </span>
        <span
          style={{
            fontStyle: 'italic',
            color: 'var(--accent-blue)',
            fontWeight: 600,
            fontSize: 14,
          }}
        >
          AI
        </span>
        </a>
      </div>

      {/* Ticker marquee */}
      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          marginLeft: 24,
          position: 'relative',
        }}
      >
        {!connected && (
          <span
            style={{
              position: 'absolute',
              right: 0,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--danger)',
              fontSize: 10,
              zIndex: 2,
            }}
            title="Ticker offline"
          >
            ●
          </span>
        )}
        <div className="marquee-track">
          {TICKER_ITEMS.map((item, i) => renderTickerItem(item, i))}
          {TICKER_ITEMS.map((item, i) => renderTickerItem(item, i + TICKER_ITEMS.length))}
        </div>
      </div>

      {/* Theme Toggle */}
      <button
        className="theme-toggle"
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        aria-label="Toggle theme"
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {/* Auth */}
      {isSignedIn ? (
        <div style={{ marginLeft: 8 }}>
          <UserButton afterSignOutUrl="#" />
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
          <SignInButton mode="modal">
            <button
              style={{
                background: 'none',
                border: '1px solid var(--card-border)',
                borderRadius: 8,
                color: 'var(--text-primary)',
                cursor: 'pointer',
                padding: '6px 14px',
                fontSize: 13,
                fontWeight: 500,
                transition: 'border-color 0.2s, color 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent-blue)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent-blue)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--card-border)';
                (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
              }}
            >
              Sign in
            </button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button
              style={{
                background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-teal))',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                cursor: 'pointer',
                padding: '6px 14px',
                fontSize: 13,
                fontWeight: 600,
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.85'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; }}
            >
              Sign up
            </button>
          </SignUpButton>
        </div>
      )}
    </nav>
  );
}
