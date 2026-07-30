import { useEffect, useState } from "react";

// Debounces `term` and calls `fetchFn(term)` 300ms after it stops
// changing, skipping entirely while `enabled` is false (e.g. the caller
// wants to skip fetching for an empty term). Used by the horse search in
// SimulationSetup. Returns a [results, setResults] pair (like useState) so
// callers can still clear the list immediately on selection, without
// waiting for the next debounce.
export function useDebouncedSearch(term, enabled, fetchFn, delay = 300) {
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => {
      fetchFn(term).then(setResults).catch(() => {});
    }, delay);
    return () => clearTimeout(timer);
  }, [term, enabled, fetchFn, delay]);

  return [results, setResults];
}
