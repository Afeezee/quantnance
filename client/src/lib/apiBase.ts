const rawApiUrl = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/+$/, '');

function isLocalHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

export function getApiBaseUrl() {
  if (!rawApiUrl || typeof window === 'undefined') {
    return rawApiUrl;
  }

  try {
    const configuredUrl = new URL(rawApiUrl, window.location.origin);

    // Ignore checked-in localhost config when the app is running on a real domain.
    if (!isLocalHostname(window.location.hostname) && isLocalHostname(configuredUrl.hostname)) {
      return '';
    }
  } catch {
    return rawApiUrl;
  }

  return rawApiUrl;
}

export const API_URL = getApiBaseUrl();