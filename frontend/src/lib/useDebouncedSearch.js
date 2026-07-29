import { useEffect, useState } from "react";

// Debounces `term` and calls `fetchFn(term)` 300ms after it stops
// changing, skipping entirely while `enabled` is false (e.g. the other
// simulation mode is active, or the caller wants to skip fetching for an
// empty term). Shared by the real-race and horse searches in
// SimulationSetup — only the term/fetch function/enabled condition differ
// between them. Returns a [results, setResults] pair (like useState) so
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
