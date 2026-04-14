import { useState, useCallback } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL ?? '';

export interface SearchResult {
  symbol: string;
  name: string;
  type: string;
  region: string;
  currency: string;
  matchScore: string;
}

export function useSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const submitSearch = useCallback(async (q: string): Promise<SearchResult[]> => {
    const trimmed = q.trim();
    if (!trimmed) return [];
    setSearching(true);
    setHasSearched(true);
    try {
      const { data } = await axios.get<SearchResult[]>(`${API_URL}/api/search`, {
        params: { q: trimmed },
        timeout: 30000,
      });
      setResults(data);
      return data;
    } catch {
      setResults([]);
      return [];
    } finally {
      setSearching(false);
    }
  }, []);

  const resetSearch = useCallback(() => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
  }, []);

  return { query, setQuery, results, searching, hasSearched, submitSearch, resetSearch };
}
