import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import axios from 'axios';

import { authedDelete, authedGet, authedPost } from '../lib/authedAxios';

export interface HistoryEntry {
  id: string;
  prompt: string;
  displayPrompt?: string;
  mode: 'analyze' | 'compare' | 'recommend' | 'research' | 'quantdocs';
  timestamp: number;
}

type HistoryMode = HistoryEntry['mode'];

interface HistoryApiEntry {
  id: string;
  prompt: string;
  display_prompt?: string | null;
  mode: HistoryMode;
  timestamp: number;
}

interface HistoryListResponse {
  entries: HistoryApiEntry[];
  has_more: boolean;
}

const API_URL = import.meta.env.VITE_API_URL ?? '';
const LEGACY_STORAGE_KEY = 'quantnance-search-history';
const LEGACY_MIGRATION_PREFIX = 'quantnance-search-history-migrated';
const PAGE_SIZE = 50;


function getMigrationKey(userId: string) {
  return `${LEGACY_MIGRATION_PREFIX}:${userId}`;
}


function loadLegacyHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((entry): entry is HistoryEntry => (
        typeof entry?.id === 'string'
        && typeof entry?.prompt === 'string'
        && typeof entry?.mode === 'string'
        && typeof entry?.timestamp === 'number'
      ))
      .map((entry) => ({
        id: entry.id,
        prompt: entry.prompt,
        displayPrompt: entry.displayPrompt,
        mode: entry.mode,
        timestamp: entry.timestamp,
      }));
  } catch {
    return [];
  }
}


function normalizeHistoryEntry(entry: HistoryApiEntry): HistoryEntry {
  return {
    id: entry.id,
    prompt: entry.prompt,
    displayPrompt: entry.display_prompt ?? undefined,
    mode: entry.mode,
    timestamp: entry.timestamp,
  };
}


function mergeHistoryEntries(existing: HistoryEntry[], incoming: HistoryEntry[]) {
  if (incoming.length === 0) {
    return existing;
  }

  const seenIds = new Set(existing.map((entry) => entry.id));
  return [...existing, ...incoming.filter((entry) => !seenIds.has(entry.id))];
}


function upsertHistoryEntry(existing: HistoryEntry[], incoming: HistoryEntry) {
  return [incoming, ...existing.filter((entry) => entry.id !== incoming.id)]
    .sort((left, right) => right.timestamp - left.timestamp);
}


function extractErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) {
    return fallback;
  }
  return error.response?.data?.detail ?? error.message ?? fallback;
}


export function useSearchHistory() {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const historyRef = useRef<HistoryEntry[]>([]);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  const requestHistoryPage = useCallback(async (offset: number) => {
    const { data } = await authedGet<HistoryListResponse>(getToken, `${API_URL}/api/history`, {
      params: { limit: PAGE_SIZE, offset },
      timeout: 60000,
    });

    return {
      entries: data.entries.map(normalizeHistoryEntry),
      hasMore: data.has_more,
    };
  }, [getToken]);

  const migrateLegacyHistory = useCallback(async () => {
    if (!userId || !isSignedIn) {
      return;
    }

    if (localStorage.getItem(getMigrationKey(userId)) === '1') {
      return;
    }

    const legacyEntries = loadLegacyHistory();
    if (legacyEntries.length === 0) {
      localStorage.setItem(getMigrationKey(userId), '1');
      return;
    }

    await authedPost<{ imported_count: number }>(getToken, `${API_URL}/api/history/import`, {
      entries: legacyEntries.map((entry) => ({
        prompt: entry.prompt,
        display_prompt: entry.displayPrompt,
        mode: entry.mode,
        timestamp: entry.timestamp,
      })),
    }, {
      timeout: 60000,
    });

    localStorage.setItem(getMigrationKey(userId), '1');
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }, [getToken, isSignedIn, userId]);

  const refreshHistory = useCallback(async () => {
    const page = await requestHistoryPage(0);
    setHistory(page.entries);
    setHasMore(page.hasMore);
  }, [requestHistoryPage]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapHistory() {
      if (!isLoaded) {
        return;
      }

      if (!isSignedIn || !userId) {
        setHistory([]);
        setHasMore(false);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        await migrateLegacyHistory();
        const page = await requestHistoryPage(0);
        if (cancelled) {
          return;
        }
        setHistory(page.entries);
        setHasMore(page.hasMore);
      } catch (requestError) {
        if (!cancelled) {
          setError(extractErrorMessage(requestError, 'Could not load search history.'));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void bootstrapHistory();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, migrateLegacyHistory, requestHistoryPage, userId]);

  const addEntry = useCallback((
    prompt: string,
    mode: HistoryMode,
    displayPrompt?: string,
  ) => {
    const latest = historyRef.current[0];
    const currentLabel = (displayPrompt ?? prompt).trim().toLowerCase();
    const previousLabel = latest ? (latest.displayPrompt ?? latest.prompt).trim().toLowerCase() : '';

    if (!isLoaded || !isSignedIn) {
      return Promise.resolve();
    }

    if (latest && latest.mode === mode && previousLabel === currentLabel) {
      return Promise.resolve();
    }

    setError(null);
    return authedPost<HistoryApiEntry>(getToken, `${API_URL}/api/history`, {
      prompt,
      display_prompt: displayPrompt,
      mode,
      timestamp: Date.now(),
    }, {
      timeout: 60000,
    })
      .then(({ data }) => {
        const entry = normalizeHistoryEntry(data);
        setHistory((prev) => upsertHistoryEntry(prev, entry));
      })
      .catch((requestError: unknown) => {
        setError(extractErrorMessage(requestError, 'Could not save search history.'));
      });
  }, [getToken, isLoaded, isSignedIn]);

  const deleteEntry = useCallback(async (entryId: string) => {
    if (!isSignedIn) {
      return;
    }

    const previousHistory = historyRef.current;
    setPendingDeleteIds((prev) => {
      const next = new Set(prev);
      next.add(entryId);
      return next;
    });
    setHistory((prev) => prev.filter((entry) => entry.id !== entryId));
    setError(null);

    try {
      await authedDelete<void>(getToken, `${API_URL}/api/history/${entryId}`, {
        timeout: 60000,
      });
    } catch (requestError) {
      setHistory(previousHistory);
      setError(extractErrorMessage(requestError, 'Could not delete history entry.'));
    } finally {
      setPendingDeleteIds((prev) => {
        const next = new Set(prev);
        next.delete(entryId);
        return next;
      });
    }
  }, [getToken, isSignedIn]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || !isSignedIn) {
      return;
    }

    setLoadingMore(true);
    setError(null);
    try {
      const page = await requestHistoryPage(historyRef.current.length);
      setHistory((prev) => mergeHistoryEntries(prev, page.entries));
      setHasMore(page.hasMore);
    } catch (requestError) {
      setError(extractErrorMessage(requestError, 'Could not load more history.'));
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, isSignedIn, loadingMore, requestHistoryPage]);

  return {
    history,
    loading,
    loadingMore,
    hasMore,
    error,
    pendingDeleteIds,
    addEntry,
    deleteEntry,
    loadMore,
    refreshHistory,
  };
}
