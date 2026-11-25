import type { Identification } from "@/lib/types";

/**
 * A fresh result is kept in sessionStorage so the result page renders
 * instantly after analysis. The server copy (/api/identifications/:id) is
 * the source of truth; "local" is used only when saving to the server failed.
 */
const key = (id: string) => `algaeai:result:${id}`;

export function cacheResult(result: Identification, localPreview?: string | null): string {
  const id = result.id || "local";
  const value = id === "local" ? { ...result, image_url: result.image_url || localPreview || null } : result;
  try {
    sessionStorage.setItem(key(id), JSON.stringify(value));
  } catch {
    // Storage full or unavailable: the page will fetch from the server instead.
  }
  return id;
}

export function readCachedResult(id: string): Identification | null {
  try {
    const raw = sessionStorage.getItem(key(id));
    return raw ? (JSON.parse(raw) as Identification) : null;
  } catch {
    return null;
  }
}
