import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { API_URL } from '../../lib/apiBase';

type HealthState = 'checking' | 'ok' | 'error';

function getDisplayApiBase() {
  return API_URL || 'same-origin (/api)';
}

export default function ApiDebugBanner() {
  const location = useLocation();
  const enabled = useMemo(() => new URLSearchParams(location.search).get('debugApi') === '1', [location.search]);
  const [healthState, setHealthState] = useState<HealthState>('checking');
  const [healthMessage, setHealthMessage] = useState('Checking backend');

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const controller = new AbortController();
    const healthUrl = `${API_URL}/api/health`;

    async function checkHealth() {
      try {
        setHealthState('checking');
        setHealthMessage('Checking backend');

        const response = await fetch(healthUrl, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        setHealthState('ok');
        setHealthMessage('Backend reachable');
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Network error';
        setHealthState('error');
        setHealthMessage(message);
      }
    }

    void checkHealth();

    return () => {
      controller.abort();
    };
  }, [enabled]);

  if (!enabled) {
    return null;
  }

  const statusColor = healthState === 'ok'
    ? '#14b8a6'
    : healthState === 'error'
      ? '#f97316'
      : '#60a5fa';

  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 95,
        maxWidth: 340,
        padding: '10px 12px',
        borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(7, 12, 20, 0.88)',
        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.28)',
        backdropFilter: 'blur(16px)',
        color: 'var(--text-primary)',
        fontSize: 12,
        lineHeight: 1.45,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: statusColor,
            flexShrink: 0,
          }}
        />
        <strong style={{ fontSize: 12, fontWeight: 700 }}>API Debug</strong>
      </div>
      <div style={{ color: 'var(--text-secondary)' }}>
        Base: <span style={{ color: 'var(--text-primary)' }}>{getDisplayApiBase()}</span>
      </div>
      <div style={{ color: 'var(--text-secondary)' }}>
        Health: <span style={{ color: 'var(--text-primary)' }}>{healthMessage}</span>
      </div>
    </div>
  );
}