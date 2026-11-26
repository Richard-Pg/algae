"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState, Notice, PageLoading } from "@/components/ui/Primitives";
import { RiskBadge } from "@/components/ui/Tags";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import type { SpeciesGroup, SpeciesSummary } from "@/lib/types";

interface Library {
  items: SpeciesSummary[];
  total: number;
  groups: SpeciesGroup[];
}

function Placeholder({ genus }: { genus: string }) {
  // A quiet, deterministic pattern so cards without photos still differ.
  const seed = Array.from(genus).reduce((a, c) => a + c.charCodeAt(0), 0);
  const dots = Array.from({ length: 9 }, (_, i) => ({
    cx: 20 + ((seed * (i + 3)) % 160),
    cy: 15 + ((seed * (i + 7)) % 90),
    r: 4 + ((seed + i) % 7),
  }));
  return (
    <svg viewBox="0 0 200 120" className="size-full" aria-hidden>
      <rect width="200" height="120" fill="#16231d" />
      {dots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r={d.r} fill="#9fd18b" opacity={0.25 + (i % 3) * 0.15} />
      ))}
    </svg>
  );
}

function Thumbnail({ src, genus }: { src?: string | null; genus: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <Placeholder genus={genus} />;
  return <img src={src} alt="" loading="lazy" className="size-full object-cover" onError={() => setFailed(true)} />;
}

function LibraryContent() {
  const router = useRouter();
  const params = useSearchParams();
  const { isAdmin } = useAuth();
  const [library, setLibrary] = useState<Library | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(params.get("q") || "");
  const group = params.get("group") || "";
  const harmful = params.get("harmful") === "1";

  useEffect(() => {
    api<Library>("/api/species", { auth: false })
      .then(setLibrary)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load the library."));
  }, []);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`/species${next.toString() ? `?${next}` : ""}`, { scroll: false });
  };

  const items = useMemo(() => {
    if (!library) return [];
    const q = query.trim().toLowerCase();
    return library.items.filter(
      (s) =>
        (!group || s.group === group) &&
        (!harmful || s.produces_toxin) &&
        (!q || s.genus.toLowerCase().includes(q) || (s.family || "").toLowerCase().includes(q) || s.description.toLowerCase().includes(q)),
    );
  }, [library, query, group, harmful]);

  return (
    <>
      <section className="on-ink bg-ink text-ink-text">
        <div className="mx-auto max-w-7xl px-4 pt-12 pb-10 sm:px-8">
          <p className="label">Open species library</p>
          <h1 className="mt-3 max-w-3xl font-serif text-5xl leading-[1.05] text-white sm:text-6xl">
            Reviewed records of algae and diatoms
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-soft">
            Each genus has curated taxonomy, toxin and ecology notes, reference images and the community observations a
            reviewer has approved.
          </p>
          <div className="mt-8 flex max-w-xl items-center gap-3 rounded-xl border border-ink-line bg-ink-raised px-4">
            <Search className="size-5 text-ink-muted" aria-hidden />
            <label htmlFor="species-search" className="sr-only">
              Search genera
            </label>
            <input
              id="species-search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setParam("q", e.target.value);
              }}
              placeholder="Search a genus, family or keyword"
              className="h-12 w-full bg-transparent text-white placeholder:text-ink-muted focus:outline-none"
            />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setParam("group", "")}
            aria-pressed={!group}
            className={`rounded-lg border px-3 py-1.5 text-sm ${!group ? "border-ink bg-ink text-white" : "border-line bg-surface text-muted hover:text-text"}`}
          >
            All <span className="font-mono">{library?.items.length ?? ""}</span>
          </button>
          {library?.groups
            .filter((g) => g.count > 0)
            .map((g) => (
              <button
                key={g.id}
                type="button"
                aria-pressed={group === g.id}
                onClick={() => setParam("group", group === g.id ? "" : g.id)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${group === g.id ? "border-ink bg-ink text-white" : "border-line bg-surface text-muted hover:text-text"}`}
              >
                {g.label} <span className="font-mono">{g.count}</span>
              </button>
            ))}
          <label className="ml-auto flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={harmful}
              onChange={(e) => setParam("harmful", e.target.checked ? "1" : "")}
              className="size-4 accent-[#b42318]"
            />
            Toxin producers only
          </label>
        </div>

        {error && <Notice tone="error">{error}</Notice>}
        {!library && !error && <PageLoading label="Loading the library…" />}

        {library && items.length === 0 && (
          <EmptyState title="No genera match" action={<ButtonLink href="/contribute" variant="secondary">Contribute a new genus</ButtonLink>}>
            Try another search, or submit an observation so a reviewer can add it.
          </EmptyState>
        )}

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((s) => (
            <li key={s.genus}>
              <Link
                href={`/species/${encodeURIComponent(s.genus)}`}
                className="flex h-full flex-col overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-line-strong"
              >
                <div className="aspect-[5/3] overflow-hidden bg-ink-raised">
                  <Thumbnail src={s.thumbnail} genus={s.genus} />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="flex items-center gap-2 font-serif text-2xl leading-tight italic">
                      {s.genus}
                      {isAdmin && s.review_status === "draft" && (
                        <span className="size-1.5 shrink-0 rounded-full bg-[#d9c27a]" title="Draft: not yet reviewed" aria-label="Draft record" />
                      )}
                    </h2>
                    <RiskBadge level={s.risk_level} />
                  </div>
                  <p className="mt-1 text-sm text-muted">{[s.phylum, s.family].filter(Boolean).join(" · ")}</p>
                  <p className="mt-3 line-clamp-3 text-[15px] leading-relaxed text-[#2b3631]">{s.description}</p>
                  <div className="mt-auto flex gap-4 pt-4 text-xs text-muted">
                    {s.water_type && <span>{s.water_type}</span>}
                    {s.species_count > 0 && (
                      <span>
                        <span className="font-mono">{s.species_count}</span> species listed
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export default function SpeciesLibraryPage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <LibraryContent />
    </Suspense>
  );
}
