import { API_URL } from './apiBase';

interface AppConfigResponse {
  clerk_publishable_key?: string | null;
}

export interface AppRuntimeConfig {
  clerkPublishableKey: string;
}

const envClerkKey = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? '').trim();

export async function loadAppRuntimeConfig(): Promise<AppRuntimeConfig> {
  if (envClerkKey) {
    return { clerkPublishableKey: envClerkKey };
  }

  const response = await fetch(`${API_URL}/api/app-config`, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to load app config (${response.status})`);
  }

  const data = (await response.json()) as AppConfigResponse;
  const clerkPublishableKey = data.clerk_publishable_key?.trim();

  if (!clerkPublishableKey) {
    throw new Error('Missing Clerk publishable key in runtime config');
  }

  return { clerkPublishableKey };
}