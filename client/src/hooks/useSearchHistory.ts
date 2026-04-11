import { useState, useCallback } from 'react';

export interface HistoryEntry {
  id: string;
  prompt: string;
  mode: 'analyze' | 'compare' | 'recommend';
  timestamp: number;
}

const STORAGE_KEY = 'quantnance-search-history';
const MAX_ENTRIES = 20;

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(entries: HistoryEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

export function useSearchHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);

  const addEntry = useCallback((prompt: string, mode: 'analyze' | 'compare' | 'recommend') => {
    setHistory((prev) => {
      // Don't add duplicates of immediately-previous search
      if (prev.length > 0 && prev[0].prompt.toLowerCase() === prompt.toLowerCase()) {
        return prev;
      }
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        prompt,
        mode,
        timestamp: Date.now(),
      };
      const next = [entry, ...prev].slice(0, MAX_ENTRIES);
      saveHistory(next);
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setHistory([]);
  }, []);

  return { history, addEntry, clearHistory };
}
