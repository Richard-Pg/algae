const GBIF = "https://api.gbif.org/v1";
const ALGAL_KINGDOMS = ["bacteria", "chromista", "plantae", "protozoa"];

interface GbifMatch {
  usageKey?: number;
  genusKey?: number;
  kingdom?: string;
  matchType?: string;
  confidence?: number;
  scientificName?: string;
  alternatives?: GbifMatch[];
}

/** Resolve a genus to a GBIF key, preferring kingdoms that contain algae. */
export async function resolveGenusKey(genus: string): Promise<{ key: number; name: string } | null> {
  const res = await fetch(`${GBIF}/species/match?name=${encodeURIComponent(genus)}&rank=GENUS&verbose=true`);
  if (!res.ok) return null;
  const data: GbifMatch = await res.json();
  const candidates = [data, ...(data.alternatives || [])].filter(
    (c) => c.usageKey && c.matchType !== "NONE" && (c.confidence ?? 0) >= 80,
  );
  const match = candidates.find((c) => ALGAL_KINGDOMS.includes((c.kingdom || "").toLowerCase()));
  if (!match) return null;
  return { key: (match.genusKey || match.usageKey) as number, name: match.scientificName || genus };
}

export interface GbifSummary {
  occurrences: number;
  images: { url: string; credit?: string }[];
}

export async function fetchGbifSummary(taxonKey: number): Promise<GbifSummary> {
  const [countRes, mediaRes] = await Promise.all([
    fetch(`${GBIF}/occurrence/search?taxonKey=${taxonKey}&limit=0`),
    fetch(`${GBIF}/occurrence/search?taxonKey=${taxonKey}&mediaType=StillImage&limit=24`),
  ]);
  const count = countRes.ok ? await countRes.json() : { count: 0 };
  const media = mediaRes.ok ? await mediaRes.json() : { results: [] };
  const seen = new Set<string>();
  const images: GbifSummary["images"] = [];
  for (const result of media.results || []) {
    for (const item of result.media || []) {
      const url: string | undefined = item.identifier;
      if (item.type === "StillImage" && url?.startsWith("http") && !seen.has(url)) {
        seen.add(url);
        images.push({ url, credit: item.rightsHolder || item.creator || result.institutionCode });
      }
    }
  }
  return { occurrences: count.count || 0, images: images.slice(0, 8) };
}

export function gbifSpeciesUrl(key: number): string {
  return `https://www.gbif.org/species/${key}`;
}
