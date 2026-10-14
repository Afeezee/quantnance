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

// In a production build, VITE_API_URL MUST be set to the deployed backend's
// origin (e.g. https://quantnance-api.vercel.app). We refuse to silently fall
// back to localhost in that case — surface a loud console error at startup so
// a missing env var is obvious instead of showing broken requests downstream.
if (import.meta.env.PROD && typeof window !== 'undefined' && !API_URL) {
  // eslint-disable-next-line no-console
  console.error(
    '[Quantnance] VITE_API_URL is not configured for this production build. ' +
      'All API calls will fail. Set VITE_API_URL in the Vercel project settings ' +
      'to the deployed backend URL and redeploy.',
  );
}