import { useState, useCallback } from 'react';

export interface HistoryEntry {
  id: string;
  prompt: string;
  displayPrompt?: string;
  mode: 'analyze' | 'compare' | 'recommend' | 'research' | 'quantdocs';
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

  const addEntry = useCallback((
    prompt: string,
    mode: 'analyze' | 'compare' | 'recommend' | 'research' | 'quantdocs',
    displayPrompt?: string,
  ) => {
    setHistory((prev) => {
      const currentLabel = (displayPrompt ?? prompt).toLowerCase();
      const previousLabel = prev.length > 0 ? (prev[0].displayPrompt ?? prev[0].prompt).toLowerCase() : '';
      // Don't add duplicates of immediately-previous search
      if (prev.length > 0 && previousLabel === currentLabel && prev[0].mode === mode) {
        return prev;
      }
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        prompt,
        displayPrompt,
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
