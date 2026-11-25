export type ConfidenceBand = { label: string; tone: "strong" | "moderate" | "weak" };

/** Model confidence is not calibrated, so show it as a band, not a precise score. */
export function confidenceBand(confidence: number | undefined): ConfidenceBand {
  const c = confidence ?? 0;
  if (c >= 0.7) return { label: "Likely match", tone: "strong" };
  if (c >= 0.4) return { label: "Possible match", tone: "moderate" };
  return { label: "Uncertain", tone: "weak" };
}

export function percent(value: number | undefined): string {
  return `${Math.round((value ?? 0) * 100)}%`;
}

export type RiskTone = "high" | "medium" | "low" | "none" | "unknown";

export function riskTone(level: string | undefined): RiskTone {
  const l = (level || "").toLowerCase();
  if (l.startsWith("high")) return "high";
  if (l.startsWith("med") || l.startsWith("moderate")) return "medium";
  if (l.startsWith("low")) return "low";
  if (l === "none" || l === "no") return "none";
  return "unknown";
}

export function yesNo(value: boolean | string | undefined): string {
  if (value === true) return "Yes";
  if (value === false) return "No";
  if (typeof value === "string" && value) return value;
  return "Unknown";
}

export function formatDate(value?: string | null, withTime = false): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
  });
}

/** "Microcystis aeruginosa" from genus + species, tolerating either holding the full binomial. */
export function scientificName(genus?: string, species?: string): string {
  const g = (genus || "").trim();
  const s = (species || "").trim();
  if (!s) return g || "Unknown";
  if (!g || s.toLowerCase().startsWith(g.toLowerCase())) return s;
  return `${g} ${s}`;
}

export function shortId(id?: string | null): string {
  return id ? id.slice(0, 8).toUpperCase() : "LOCAL";
}

export const imageTypeLabel: Record<string, string> = {
  microscope: "Microscope",
  bloom: "Bloom photo",
  surface_water: "Surface water",
  field_sample: "Field sample",
  unknown: "Unknown source",
};
