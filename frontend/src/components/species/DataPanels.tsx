import type { ReactNode } from "react";
import { ExternalLink } from "lucide-react";
import { KeyValue, Panel, PanelHeader } from "@/components/ui/Primitives";
import { SourceTag, type SourceKind } from "@/components/ui/Tags";
import { riskTone, yesNo } from "@/lib/format";
import type { EcologyInfo, Reference, Taxonomy, ToxinInfo } from "@/lib/types";

const RANKS: (keyof Taxonomy)[] = ["kingdom", "phylum", "class", "order", "family", "genus", "species"];

export function TaxonomyPanel({ taxonomy, source }: { taxonomy: Taxonomy; source: SourceKind }) {
  const rows = RANKS.filter((r) => taxonomy[r]);
  return (
    <Panel>
      <PanelHeader title="Taxonomy">
        <SourceTag kind={source} />
      </PanelHeader>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">No taxonomy recorded.</p>
      ) : (
        <dl className="grid grid-cols-[6.5rem_minmax(0,1fr)] gap-y-2 text-[15px]">
          {rows.map((rank) => (
            <div key={rank} className="contents">
              <dt className="text-muted capitalize">{rank}</dt>
              <dd className={rank === "genus" || rank === "species" ? "font-serif text-lg leading-tight italic" : ""}>{taxonomy[rank]}</dd>
            </div>
          ))}
        </dl>
      )}
    </Panel>
  );
}

const riskText: Record<string, string> = {
  high: "text-risk-high",
  medium: "text-risk-medium",
  low: "text-brand",
  none: "text-brand",
  unknown: "text-muted",
};

/** Four headline facts. Toxin risk is tinted when it matters. */
export function KeyFacts({ toxin, ecology }: { toxin: ToxinInfo; ecology: EcologyInfo }) {
  const tone = riskTone(toxin.risk_level);
  const hot = tone === "high" || tone === "medium";
  const card = (label: string, value: ReactNode, sub?: string, extra = "") => (
    <div className={`min-w-0 rounded-xl border p-4 sm:p-5 ${extra || "border-line bg-surface"}`}>
      <div className="label">{label}</div>
      <div className="mt-2 text-lg leading-tight font-semibold [overflow-wrap:anywhere] hyphens-auto sm:text-2xl">{value}</div>
      {sub && <div className="mt-1 text-sm text-muted">{sub}</div>}
    </div>
  );
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {card(
        "Toxin risk",
        <span className={riskText[tone]}>{toxin.risk_level || "Unknown"}</span>,
        toxin.toxin_type && toxin.toxin_type !== "None" ? toxin.toxin_type : yesNo(toxin.produces_toxin) === "No" ? "No known toxins" : undefined,
        hot ? (tone === "high" ? "border-risk-high-line bg-risk-high-tint" : "border-risk-medium-line bg-risk-medium-tint") : "",
      )}
      {card("Bloom temperature", <span className="font-mono text-xl">{ecology.temperature_range || "—"}</span>, ecology.seasonal_pattern)}
      {card("Water type", ecology.water_type || "—", ecology.habitat)}
      {card("Indicator of", ecology.indicator_of || "—", ecology.nutrient_preference)}
    </div>
  );
}

export function ToxinPanel({ toxin, source }: { toxin: ToxinInfo; source: SourceKind }) {
  return (
    <Panel>
      <PanelHeader title="Toxins and health">
        <SourceTag kind={source} />
      </PanelHeader>
      <dl className="grid gap-5 sm:grid-cols-3">
        <KeyValue label="Produces toxin">{yesNo(toxin.produces_toxin)}</KeyValue>
        <KeyValue label="Toxin type">{toxin.toxin_type || "—"}</KeyValue>
        <KeyValue label="Risk level">
          <span className={`font-semibold ${riskText[riskTone(toxin.risk_level)]}`}>{toxin.risk_level || "Unknown"}</span>
        </KeyValue>
      </dl>
      {toxin.health_effects && (
        <dl className="mt-5">
          <KeyValue label="Health effects">{toxin.health_effects}</KeyValue>
        </dl>
      )}
    </Panel>
  );
}

const ECOLOGY: { key: keyof EcologyInfo; label: string; mono?: boolean }[] = [
  { key: "habitat", label: "Habitat" },
  { key: "water_type", label: "Water type" },
  { key: "temperature_range", label: "Temperature", mono: true },
  { key: "seasonal_pattern", label: "Season" },
  { key: "nutrient_preference", label: "Nutrients" },
  { key: "indicator_of", label: "Indicator of" },
];

export function EcologyPanel({ ecology, source }: { ecology: EcologyInfo; source: SourceKind }) {
  const rows = ECOLOGY.filter((r) => ecology[r.key]);
  return (
    <Panel>
      <PanelHeader title="Ecology">
        <SourceTag kind={source} />
      </PanelHeader>
      {rows.length === 0 && !ecology.bloom_conditions ? (
        <p className="text-sm text-muted">No ecology recorded.</p>
      ) : (
        <>
          <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((r) => (
              <KeyValue key={r.key} label={r.label} mono={r.mono}>
                {String(ecology[r.key])}
              </KeyValue>
            ))}
          </dl>
          {ecology.bloom_conditions && (
            <div className="mt-5 rounded-lg bg-paper p-4">
              <div className="label">Bloom conditions</div>
              <p className="mt-1 text-[15px]">{ecology.bloom_conditions}</p>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

export function ReferenceList({ references, source }: { references: Reference[]; source: SourceKind }) {
  if (!references.length) return null;
  return (
    <Panel>
      <PanelHeader title="References">
        <SourceTag kind={source} />
      </PanelHeader>
      <ul className="space-y-3 text-[15px]">
        {references.map((ref, i) => {
          const isLink = ref.url && /^https?:\/\//.test(ref.url);
          return (
            <li key={i} className="flex gap-3">
              <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0">
                {isLink ? (
                  <a href={ref.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all text-brand hover:underline">
                    {ref.label || ref.url} <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                  </a>
                ) : (
                  <span>{ref.label || ref.url}</span>
                )}
                {ref.notes && <p className="text-sm text-muted">{ref.notes}</p>}
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
