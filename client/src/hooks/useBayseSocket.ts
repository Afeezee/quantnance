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
  EURNGN: { price: 1700.0, change: 0, timestamp: Date.now() },
  GBPNGN: { price: 1950.0, change: 0, timestamp: Date.now() },
  CADNGN: { price: 1100.0, change: 0, timestamp: Date.now() },
  CHFNGN: { price: 1700.0, change: 0, timestamp: Date.now() },
  CNYNGN: { price: 210.0, change: 0, timestamp: Date.now() },
  JPYNGN: { price: 10.0, change: 0, timestamp: Date.now() },
  AEDNGN: { price: 420.0, change: 0, timestamp: Date.now() },
  ZARNGN: { price: 82.0, change: 0, timestamp: Date.now() },
};

// CoinGecko rate keys for each FX pair (all vs NGN)
const FX_PAIRS: Record<string, string> = {
  USDNGN: 'usd',
  EURNGN: 'eur',
  GBPNGN: 'gbp',
  CADNGN: 'cad',
  CHFNGN: 'chf',
  CNYNGN: 'cny',
  JPYNGN: 'jpy',
  AEDNGN: 'aed',
  ZARNGN: 'zar',
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

      // Fetch FX rates from CoinGecko (all rates are per 1 BTC, so divide to get X/NGN)
      try {
        const fxResp = await fetch(
          'https://api.coingecko.com/api/v3/exchange_rates'
        );
        if (fxResp.ok) {
          const fxData = await fxResp.json();
          const ngnPerBtc = fxData?.rates?.ngn?.value;
          if (ngnPerBtc) {
            for (const [pairKey, geckoKey] of Object.entries(FX_PAIRS)) {
              const basePerBtc = fxData?.rates?.[geckoKey]?.value;
              if (basePerBtc && basePerBtc > 0) {
                updated[pairKey] = {
                  price: ngnPerBtc / basePerBtc,
                  change: 0,
                  timestamp: Date.now(),
                };
              }
            }
          }
        }
      } catch {
        // keep fallback FX rates
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
