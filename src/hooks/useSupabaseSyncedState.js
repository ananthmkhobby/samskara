import { useEffect, useRef, useState } from "react";
import { saveKV } from "../lib/kvStore";

// Write-through counterpart to useLocalStorageState. The initial value is
// expected to already be hydrated from Supabase (see initDataLayer in
// data/people.js, awaited before the app's first render in main.jsx) — so
// this hook only needs to persist changes going forward, not fetch on mount.
export function useSupabaseSyncedState(key, initialValue) {
  const [state, setState] = useState(initialValue);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    saveKV(key, state);
  }, [key, state]);

  return [state, setState];
}
