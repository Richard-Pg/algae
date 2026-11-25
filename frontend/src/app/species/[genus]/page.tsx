"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, PageLoading, Panel, PanelHeader, SpeciesName } from "@/components/ui/Primitives";
import { RiskBadge, SourceTag } from "@/components/ui/Tags";
import { EcologyPanel, KeyFacts, ReferenceList, TaxonomyPanel, ToxinPanel } from "@/components/species/DataPanels";
import { DistributionPanel, ImageGallery, type GalleryImage } from "@/components/species/GbifPanels";
import { api, ApiError } from "@/lib/api";
import { formatDate } from "@/lib/format";
import type { SpeciesRecord } from "@/lib/types";
import { useGbif } from "@/lib/useGbif";

const groupLabel: Record<string, string> = {
  cyanobacteria: "Cyanobacteria",
  diatoms: "Diatoms",
  "green-algae": "Green algae",
  dinoflagellates: "Dinoflagellates",
  other: "Other algae",
};

export default function SpeciesPage({ params }: { params: Promise<{ genus: string }> }) {
  const { genus } = use(params);
  const name = decodeURIComponent(genus);
  const [record, setRecord] = useState<SpeciesRecord | null>(null);
  const [state, setState] = useState<"loading" | "missing" | "error" | "ok">("loading");
  const gbif = useGbif(state === "ok" ? record?.genus : undefined);

  useEffect(() => {
    api<SpeciesRecord>(`/api/species/${encodeURIComponent(name)}`, { auth: false })
      .then((r) => {
        setRecord(r);
        setState("ok");
      })
      .catch((e) => setState(e instanceof ApiError && e.status === 404 ? "missing" : "error"));
  }, [name]);

  if (state === "loading") return <PageLoading label="Loading record…" />;
  if (!record) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <EmptyState
          title={state === "missing" ? `${name} isn't in the library yet` : "This record couldn't be loaded"}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href={`/contribute?genus=${encodeURIComponent(name)}`}>Contribute an observation</ButtonLink>
              <ButtonLink href="/species" variant="secondary">Back to library</ButtonLink>
            </div>
          }
        >
          {state === "missing" ? "Approved community observations are how new genera are added." : "Refresh the page to try again."}
        </EmptyState>
      </div>
    );
  }

  const gallery: GalleryImage[] = [
    ...(record.reference_images || []).map((url, i) => ({ url, caption: `Reference ${i + 1}`, source: "curated" as const })),
    ...(gbif.summary?.images || []).map((img) => ({ url: img.url, caption: "GBIF specimen photo", source: "gbif" as const, credit: img.credit })),
  ];

  return (
    <>
      <section className="on-ink bg-ink text-ink-text">
        <div className="mx-auto max-w-7xl px-4 pt-8 pb-10 sm:px-8">
          <Link href="/species" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-white">
            <ArrowLeft className="size-4" aria-hidden /> Species library
          </Link>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
            <div className="min-w-0">
              <p className="label">{groupLabel[record.group] || "Genus"}</p>
              <h1 className="mt-3 text-6xl leading-none text-white">
                <SpeciesName name={record.genus} />
              </h1>
              <p className="mt-3 text-[15px] text-ink-soft">
                {[record.taxonomy?.phylum, record.taxonomy?.class, record.taxonomy?.family].filter(Boolean).join(" · ")}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <RiskBadge level={record.toxin?.risk_level} />
                {record.updated_at && <span className="text-xs text-ink-muted self-center">Updated {formatDate(record.updated_at)}</span>}
              </div>
            </div>
            <ButtonLink href={`/contribute?genus=${encodeURIComponent(record.genus)}`} variant="signal">
              <Send className="size-4" aria-hidden /> Contribute an observation
            </ButtonLink>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-4 px-4 py-8 sm:px-8">
        <KeyFacts toxin={record.toxin || {}} ecology={record.ecology || {}} />

        <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Panel>
            <PanelHeader title="Description">
              <SourceTag kind="curated" />
            </PanelHeader>
            <p className="text-base leading-relaxed">{record.description || "No description yet."}</p>
            {record.morphology && (
              <div className="mt-5 border-t border-line pt-4">
                <div className="label">Morphology</div>
                <p className="mt-1 text-[15px] leading-relaxed">{record.morphology}</p>
              </div>
            )}
            {!!record.common_species?.length && (
              <div className="mt-5 border-t border-line pt-4">
                <div className="label">Species in this record</div>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-lg">
                  {record.common_species.map((s) => (
                    <li key={s}>
                      <SpeciesName name={s.includes(" ") ? s : `${record.genus} ${s}`} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
          <TaxonomyPanel taxonomy={record.taxonomy || {}} source="curated" />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <ToxinPanel toxin={record.toxin || {}} source="curated" />
          <EcologyPanel ecology={record.ecology || {}} source="curated" />
        </div>

        <section aria-labelledby="images-heading" className="pt-4">
          <h2 id="images-heading" className="mb-4 text-xl font-semibold">Reference images</h2>
          <ImageGallery images={gallery} emptyText="Approved observations with images will appear here." />
        </section>

        <section aria-labelledby="distribution-heading" className="pt-4">
          <h2 id="distribution-heading" className="mb-4 text-xl font-semibold">Distribution</h2>
          <DistributionPanel gbif={gbif} />
        </section>

        <ReferenceList references={record.references || []} source="curated" />

        <section aria-labelledby="contrib-heading" className="pt-4">
          <h2 id="contrib-heading" className="mb-4 text-xl font-semibold">Community observations</h2>
          {record.contributions.length === 0 ? (
            <EmptyState title="No approved observations yet">Be the first to contribute an observation of {record.genus}.</EmptyState>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {record.contributions.map((c) => (
                <li key={c.id} className="flex items-center gap-4 p-4">
                  <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-ink-raised">
                    {c.published_image_url && <img src={c.published_image_url} alt="" className="size-full object-cover" loading="lazy" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{c.user_name || "Community member"}</div>
                    <div className="text-sm text-muted">
                      {[c.proposed_species && `${record.genus} ${c.proposed_species}`, c.location_found, formatDate(c.reviewed_at || c.created_at)]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <SourceTag kind="community" label="Approved" />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
