"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { ExternalLink } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState, Panel, PanelHeader, Spinner } from "@/components/ui/Primitives";
import { SourceTag, type SourceKind } from "@/components/ui/Tags";
import { gbifSpeciesUrl } from "@/lib/gbif";
import type { ImageCredit } from "@/lib/types";
import type { GbifState } from "@/lib/useGbif";

const DistributionMap = dynamic(() => import("@/components/species/DistributionMap"), {
  ssr: false,
  loading: () => <div className="h-80 animate-pulse rounded-lg bg-paper" />,
});

export function DistributionPanel({ gbif }: { gbif: GbifState }) {
  if (gbif.loading) {
    return (
      <Panel className="flex items-center gap-3 text-muted">
        <Spinner /> Loading occurrence data from GBIF…
      </Panel>
    );
  }
  if (!gbif.key) {
    return (
      <EmptyState title="No GBIF record found">
        GBIF has no algal taxon matching this genus, so there is no distribution map to show.
      </EmptyState>
    );
  }
  return (
    <Panel>
      <PanelHeader title="Occurrence density">
        <SourceTag kind="gbif" />
      </PanelHeader>
      <DistributionMap taxonKey={gbif.key} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <span>
          <span className="font-mono text-text">{(gbif.summary?.occurrences ?? 0).toLocaleString()}</span> occurrence
          records for <span className="italic">{gbif.name}</span>
        </span>
        <a href={gbifSpeciesUrl(gbif.key)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand hover:underline">
          Open in GBIF <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </div>
    </Panel>
  );
}

export interface GalleryImage {
  url: string;
  /** Smaller version for the grid; the dialog shows `url`. */
  thumb?: string;
  caption: string;
  source: SourceKind | "yours";
  sourceLabel?: string;
  credit?: string;
  href?: string;
}

/** Openly licensed photos stored with a species record, with attribution. */
export function creditImages(credits: ImageCredit[] | undefined, genus: string): GalleryImage[] {
  return (credits || [])
    .filter((c) => c && c.url)
    .map((c) => ({
      url: c.url,
      thumb: c.thumb,
      caption: c.creator ? `${genus} · © ${c.creator}` : genus,
      source: "gbif" as const,
      sourceLabel: c.source || "GBIF",
      credit: [c.creator, c.license, c.source].filter(Boolean).join(" · "),
      href: c.source_url,
    }));
}

/** Side-by-side image comparison with a click-to-enlarge view. */
export function ImageGallery({ images, emptyText }: { images: GalleryImage[]; emptyText: string }) {
  const [open, setOpen] = useState<GalleryImage | null>(null);
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const visible = images.filter((i) => !broken.has(i.url));

  if (visible.length === 0) return <EmptyState title="No reference images yet">{emptyText}</EmptyState>;

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {visible.map((img) => (
          <figure key={img.url} className="rounded-xl border border-line bg-surface p-2.5">
            <button
              type="button"
              onClick={() => setOpen(img)}
              className={`block aspect-square w-full overflow-hidden rounded-lg ${img.source === "yours" ? "bg-ink ring-2 ring-signal" : "bg-paper"}`}
              aria-label={`Enlarge: ${img.caption}`}
            >
              <img
                src={img.thumb || img.url}
                alt={img.caption}
                loading="lazy"
                className="size-full object-cover transition-transform duration-300 hover:scale-[1.03]"
                onError={() => setBroken((prev) => new Set(prev).add(img.url))}
              />
            </button>
            <figcaption className="mt-2 flex items-start justify-between gap-2 text-sm">
              <span className="min-w-0 truncate" title={img.caption}>
                {img.caption}
              </span>
              {img.source === "yours" ? (
                <span className="shrink-0 rounded bg-ink px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-signal uppercase">Yours</span>
              ) : (
                <SourceTag kind={img.source} label={img.sourceLabel} />
              )}
            </figcaption>
          </figure>
        ))}
      </div>
      <Dialog open={Boolean(open)} onClose={() => setOpen(null)} title={open?.caption || ""} wide>
        {open && (
          <>
            <img src={open.url} alt={open.caption} className="max-h-[70vh] w-full rounded-lg bg-ink object-contain" />
            {open.credit && (
              <p className="mt-2 text-xs text-muted">
                Photo: {open.credit}
                {open.href && (
                  <>
                    {" · "}
                    <a href={open.href} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                      Source
                    </a>
                  </>
                )}
              </p>
            )}
          </>
        )}
      </Dialog>
    </>
  );
}
