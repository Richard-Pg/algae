"use client";

import { useEffect, useState } from "react";
import { fetchGbifSummary, resolveGenusKey, type GbifSummary } from "@/lib/gbif";

export interface GbifState {
  loading: boolean;
  key: number | null;
  name: string | null;
  summary: GbifSummary | null;
}

const EMPTY: GbifState = { loading: false, key: null, name: null, summary: null };

/** GBIF key, occurrence count and specimen photos for a genus. */
export function useGbif(genus?: string, knownKey?: number | null, knownName?: string | null): GbifState {
  const enabled = Boolean(genus) && genus!.toLowerCase() !== "unknown";
  const request = enabled ? `${genus}|${knownKey ?? ""}` : "";
  const [loaded, setLoaded] = useState<{ request: string; state: GbifState } | null>(null);

  useEffect(() => {
    if (!request || !genus) return;
    let cancelled = false;
    const run = async () => {
      let state = EMPTY;
      try {
        const resolved = knownKey ? { key: knownKey, name: knownName || genus } : await resolveGenusKey(genus);
        if (resolved) {
          const summary = await fetchGbifSummary(resolved.key);
          state = { loading: false, key: resolved.key, name: resolved.name, summary };
        }
      } catch {
        state = EMPTY;
      }
      if (!cancelled) setLoaded({ request, state });
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [request, genus, knownKey, knownName]);

  if (!enabled) return EMPTY;
  if (!loaded || loaded.request !== request) return { ...EMPTY, loading: true };
  return loaded.state;
}
