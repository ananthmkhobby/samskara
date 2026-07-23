import { useEffect, useState } from "react";

// Persists a piece of state to localStorage under `key`, hydrating from it on
// first load. Falls back silently to in-memory state if storage is unavailable
// (private browsing, quota exceeded, etc.) so the app never crashes over it.
export function useLocalStorageState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // storage full or unavailable — the session still works, just won't persist
    }
  }, [key, state]);

  return [state, setState];
}
