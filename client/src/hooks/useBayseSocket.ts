import { useEffect, useRef, useState, useCallback } from 'react';

interface PriceData {
  price: number;
  change: number;
  timestamp: number;
}

interface BayseSocketReturn {
  prices: Record<string, PriceData>;
  connected: boolean;
}

const COIN_IDS: Record<string, string> = {
  BTCUSDT: 'bitcoin',
  ETHUSDT: 'ethereum',
  SOLUSDT: 'solana',
};

const FALLBACK_PRICES: Record<string, PriceData> = {
  BTCUSDT: { price: 69420.0, change: 0, timestamp: Date.now() },
  ETHUSDT: { price: 3450.0, change: 0, timestamp: Date.now() },
  SOLUSDT: { price: 178.5, change: 0, timestamp: Date.now() },
  USDNGN: { price: 1550.0, change: 0, timestamp: Date.now() },
};

const POLL_INTERVAL = 60_000; // 60 seconds

export function useBayseSocket(): BayseSocketReturn {
  const [prices, setPrices] = useState<Record<string, PriceData>>(FALLBACK_PRICES);
  const [connected, setConnected] = useState(false);
  const mountedRef = useRef(true);

  const fetchPrices = useCallback(async () => {
    try {
      const ids = Object.values(COIN_IDS).join(',');
      const resp = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
      );
      if (!resp.ok) return;
      const data = await resp.json();
      if (!mountedRef.current) return;

      const updated: Record<string, PriceData> = { ...FALLBACK_PRICES };
      for (const [key, coinId] of Object.entries(COIN_IDS)) {
        const coin = data[coinId];
        if (coin) {
          updated[key] = {
            price: coin.usd ?? FALLBACK_PRICES[key].price,
            change: coin.usd_24h_change ?? 0,
            timestamp: Date.now(),
          };
        }
      }

      // Fetch USD/NGN from a separate endpoint
      try {
        const fxResp = await fetch(
          'https://api.coingecko.com/api/v3/exchange_rates'
        );
        if (fxResp.ok) {
          const fxData = await fxResp.json();
          const ngnRate = fxData?.rates?.ngn?.value;
          if (ngnRate) {
            updated.USDNGN = { price: ngnRate, change: 0, timestamp: Date.now() };
          }
        }
      } catch {
        // keep fallback for USD/NGN
      }

      setPrices(updated);
      setConnected(true);
    } catch {
      // Keep previous prices on failure, don't spam errors
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    const interval = setInterval(fetchPrices, POLL_INTERVAL);
    // Initial fetch deferred to avoid setState in effect body
    const timeout = setTimeout(fetchPrices, 0);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [fetchPrices]);

  return { prices, connected };
}
