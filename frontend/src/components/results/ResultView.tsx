"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Check, Copy, FileImage, Link2, Lock, Plus, Send } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Notice, Panel, PanelHeader, SpeciesName } from "@/components/ui/Primitives";
import { SourceTag, type SourceKind } from "@/components/ui/Tags";
import { Tabs } from "@/components/ui/Tabs";
import { EcologyPanel, KeyFacts, ReferenceList, TaxonomyPanel, ToxinPanel } from "@/components/species/DataPanels";
import { DistributionPanel, ImageGallery, type GalleryImage } from "@/components/species/GbifPanels";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { confidenceBand, formatDate, imageTypeLabel, percent, riskTone, scientificName, shortId } from "@/lib/format";
import type { Candidate, Identification } from "@/lib/types";
import { useGbif } from "@/lib/useGbif";

type TabId = "overview" | "details" | "compare" | "distribution" | "notes";

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setCopied(null);
    }
  };
  return { copied, copy };
}

function CandidateRow({ c, top, max }: { c: Candidate; top: boolean; max: number }) {
  const name = scientificName(c.genus, c.species);
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_5rem_3rem] items-center gap-x-4 gap-y-1 border-b border-ink-line py-3 sm:grid-cols-[minmax(0,1fr)_11rem_3.5rem]">
      <div className="min-w-0">
        <SpeciesName name={name} className={top ? "text-[22px] text-white" : "text-xl text-[#d5ded9]"} />
      </div>
      <div className="h-1.5 rounded-full bg-ink-raised" aria-hidden>
        <div className={`h-1.5 rounded-full ${top ? "bg-signal" : "bg-[#6c8a7a]"}`} style={{ width: `${Math.max(3, (c.confidence / max) * 100)}%` }} />
      </div>
      <span className={`text-right font-mono text-sm ${top ? "text-white" : "text-ink-soft"}`}>{percent(c.confidence)}</span>
      {!top && c.reason_for_exclusion && <p className="col-span-3 text-[13px] leading-snug text-ink-muted">Ruled out: {c.reason_for_exclusion}</p>}
    </li>
  );
}

function SpecimenImage({ url, name }: { url?: string | null; name?: string | null }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="grid aspect-square place-items-center overflow-hidden rounded-xl border border-ink-line bg-black">
      {url && !failed ? (
        <img src={url} alt="Your uploaded specimen" className="size-full object-contain" onError={() => setFailed(true)} />
      ) : (
        <div className="flex flex-col items-center gap-2 px-6 text-center text-ink-muted">
          <FileImage className="size-10" aria-hidden />
          <span className="text-sm">{name || "Image unavailable"}</span>
        </div>
      )}
    </div>
  );
}

export default function ResultView({ result: initial }: { result: Identification }) {
  const router = useRouter();
  const { user, requestSignIn } = useAuth();
  const [result, setResult] = useState(initial);
  const [tab, setTab] = useState<TabId>("overview");
  const [shareBusy, setShareBusy] = useState(false);
  const { copied, copy } = useCopy();

  const primary = result.primary_identification;
  const db = result.database_info || null;
  const generated = result.generated_details || {};
  const curated = db?.source === "curated" || (db && db.is_fallback === false);
  const taxonomySource: SourceKind = curated ? "curated" : db ? "gbif" : "ai";
  const factSource: SourceKind = curated ? "curated" : "ai";
  const toxin = db?.toxin || generated.toxin || {};
  const ecology = db?.ecology || generated.ecology || {};
  const taxonomy = db?.taxonomy || {};
  const gbif = useGbif(primary?.genus, db?.gbif_key ?? null, db?.gbif_name ?? null);

  const candidates = useMemo(() => {
    const list = [primary, ...(result.alternative_identifications || [])].filter(Boolean) as Candidate[];
    return list.slice(0, 4);
  }, [primary, result.alternative_identifications]);
  const maxConfidence = Math.max(0.01, ...candidates.map((c) => c.confidence));

  const name = scientificName(primary?.genus, primary?.species);
  const band = confidenceBand(primary?.confidence);
  const harmful = Boolean(result.is_harmful) || riskTone(toxin.risk_level) === "high";
  const isReal = Boolean(result.id) && result.id !== "local";
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  const gallery: GalleryImage[] = [
    ...(result.image_url ? [{ url: result.image_url, caption: "Your image", source: "yours" as const }] : []),
    ...(db?.reference_images || []).map((url, i) => ({
      url,
      caption: `${primary?.genus || "Reference"} · reference ${i + 1}`,
      source: (curated ? "curated" : "community") as SourceKind,
    })),
    ...(gbif.summary?.images || []).map((img) => ({
      url: img.url,
      caption: "GBIF specimen photo",
      source: "gbif" as SourceKind,
      credit: img.credit,
    })),
  ];

  const citation = `AlgaeAI identification ${shortId(result.id)} (${formatDate(result.created_at) || formatDate(new Date().toISOString())}): ${name}, ${band.label.toLowerCase()} (model confidence ${percent(primary?.confidence)}; ${result.ai_model || "AI model"}). Preliminary AI result; not expert-verified. ${isReal ? pageUrl : ""}`.trim();

  const submit = () => {
    const params = new URLSearchParams();
    if (result.is_owner && isReal && result.id) params.set("from", result.id);
    else {
      if (primary?.genus) params.set("genus", primary.genus);
      if (primary?.species) params.set("species", primary.species);
    }
    const target = `/contribute?${params.toString()}`;
    if (!user) {
      requestSignIn("Sign in to submit this observation for review. Your result stays here.");
      return;
    }
    router.push(target);
  };

  const toggleShare = async () => {
    if (!result.id) return;
    setShareBusy(true);
    try {
      const next = !result.is_shared;
      await api(`/api/identifications/${result.id}`, { method: "PATCH", json: { is_shared: next } });
      setResult({ ...result, is_shared: next });
      if (next) copy(pageUrl, "link");
    } finally {
      setShareBusy(false);
    }
  };

  // ------------------------------------------------------------------ not identified
  if (!result.identified) {
    return (
      <section className="on-ink bg-ink text-ink-text">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-8 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
          <SpecimenImage url={result.image_url} name={result.filename} />
          <div>
            <p className="label">Identification result</p>
            <h1 className="mt-3 font-serif text-5xl leading-tight text-white">No algae recognised</h1>
            <p className="mt-4 max-w-xl text-lg text-ink-soft">
              {result.error_message || "The model couldn't find algae or diatoms it recognises in this image."}
            </p>
            {result.suggestions && (
              <div className="mt-6 max-w-xl rounded-xl border border-ink-line bg-ink-raised p-5">
                <div className="label">Suggestions for a better image</div>
                <p className="mt-2 text-[15px] text-ink-text">{result.suggestions}</p>
              </div>
            )}
            <ul className="mt-6 max-w-xl space-y-2 text-sm text-ink-soft">
              {["Focus on one field of view with several cells", "Use 400× or higher for small coccoid cells", "Avoid heavy glare and motion blur"].map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden /> {t}
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <ButtonLink href="/" variant="signal">
                <Plus className="size-4" aria-hidden /> Try another image
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ------------------------------------------------------------------ identified
  return (
    <>
      <section className="on-ink bg-ink text-ink-text">
        <div className="mx-auto flex max-w-7xl flex-wrap gap-10 px-4 pt-8 pb-10 sm:px-8">
          <div className="w-full max-w-[440px] min-w-0 flex-[1_1_340px]">
            <SpecimenImage url={result.image_url} name={result.filename} />
            <div className="mt-2.5 flex flex-wrap justify-between gap-2 font-mono text-xs text-ink-muted">
              <span>
                ID {shortId(result.id)}
                {result.created_at ? ` · ${formatDate(result.created_at, true)}` : ""}
              </span>
              <span>
                {imageTypeLabel[result.image_type || "unknown"] || result.image_type} · quality {result.image_quality || "unknown"}
              </span>
            </div>
          </div>

          <div className="flex min-w-0 flex-[999_1_480px] flex-col">
            <p className="label">Most likely identification</p>
            <h1 className="mt-3 text-5xl leading-none text-white sm:text-6xl">
              <SpeciesName name={name} />
            </h1>
            <p className="mt-3 text-[15px] text-ink-soft">
              {[taxonomy.phylum, taxonomy.family].filter(Boolean).join(" · ") || "Taxonomy not available"}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-md px-3 py-1 text-[13px] font-semibold ${
                  band.tone === "strong" ? "bg-signal text-ink" : band.tone === "moderate" ? "bg-[#d9c27a] text-ink" : "bg-ink-raised text-ink-text ring-1 ring-ink-line"
                }`}
              >
                {band.label}
              </span>
              {harmful && (
                <span className="rounded-md bg-risk-high-on-ink px-3 py-1 text-[13px] font-semibold text-[#1a0d05]">
                  HAB species · {toxin.risk_level || "possible"} toxin risk
                </span>
              )}
              <span className="text-[13px] text-ink-muted">Confidence is the model&apos;s own estimate, not a measured probability.</span>
            </div>

            {harmful && result.hab_alert && (
              <div className="mt-5 flex gap-3 rounded-lg border border-[#6b3a22] bg-[#2a1a12] p-4">
                <AlertTriangle className="mt-0.5 size-5 shrink-0 text-risk-high-on-ink" aria-hidden />
                <p className="text-[15px] leading-relaxed text-[#f6d9c8]">{result.hab_alert}</p>
              </div>
            )}

            <ol className="mt-6 border-t border-ink-line" aria-label="Candidate identifications">
              {candidates.map((c, i) => (
                <CandidateRow key={`${c.genus}-${i}`} c={c} top={i === 0} max={maxConfidence} />
              ))}
            </ol>

            <div className="mt-auto flex flex-wrap gap-2 pt-7">
              <Button variant="signal" onClick={submit}>
                <Send className="size-4" aria-hidden /> Submit as observation
              </Button>
              {db?.source === "curated" && primary?.genus && (
                <ButtonLink href={`/species/${encodeURIComponent(primary.genus)}`} variant="ghost-ink">
                  Species record <ArrowRight className="size-4" aria-hidden />
                </ButtonLink>
              )}
              <Button variant="ghost-ink" onClick={() => copy(citation, "citation")}>
                {copied === "citation" ? <Check className="size-4 text-signal" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                {copied === "citation" ? "Copied" : "Copy citation"}
              </Button>
              {result.is_owner && isReal && user ? (
                <Button variant="ghost-ink" onClick={toggleShare} disabled={shareBusy}>
                  {result.is_shared ? <Link2 className="size-4 text-signal" aria-hidden /> : <Lock className="size-4" aria-hidden />}
                  {copied === "link" ? "Link copied" : result.is_shared ? "Shared · stop sharing" : "Share link"}
                </Button>
              ) : (
                isReal && (
                  <Button variant="ghost-ink" onClick={() => copy(pageUrl, "link")}>
                    <Link2 className="size-4" aria-hidden /> {copied === "link" ? "Link copied" : "Copy link"}
                  </Button>
                )
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="sticky top-15 z-30 border-b border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <Tabs<TabId>
            label="Result sections"
            active={tab}
            onChange={setTab}
            items={[
              { id: "overview", label: "Overview" },
              { id: "details", label: "Toxins & ecology" },
              { id: "compare", label: "Compare references" },
              { id: "distribution", label: "Distribution" },
              { id: "notes", label: "Model notes" },
            ]}
          />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 pt-7 pb-16 sm:px-8" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {!result.id && (
          <Notice tone="warning" className="mb-6" title="This result wasn't saved">
            The server couldn&apos;t store it, so it will disappear when you close this tab.
          </Notice>
        )}
        {db?.source === "gbif+ai" && (
          <Notice tone="info" className="mb-6" title={`${primary?.genus} isn't in the curated library yet`}>
            Taxonomy comes from GBIF; toxin and ecology details are AI estimates. Submitting your observation helps add a
            reviewed record.
          </Notice>
        )}

        {tab === "overview" && (
          <div className="space-y-4">
            <KeyFacts toxin={toxin} ecology={ecology} />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <TaxonomyPanel taxonomy={taxonomy} source={taxonomySource} />
              <Panel>
                <PanelHeader title="What the model saw">
                  <SourceTag kind="ai" label="AI observation" />
                </PanelHeader>
                <p className="text-base leading-relaxed">{primary?.morphological_notes || "No notes returned."}</p>
                {(db?.description || generated.description) && (
                  <div className="mt-5 border-t border-line pt-4">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="label">About this genus</span>
                      <SourceTag kind={db?.description ? factSource : "ai"} />
                    </div>
                    <p className="text-[15px] leading-relaxed text-[#2b3631]">{db?.description || generated.description}</p>
                  </div>
                )}
                <p className="mt-5 border-t border-line pt-4 text-sm text-muted">
                  AI identifications are preliminary. Confirm with morphology and references before reporting.
                </p>
              </Panel>
            </div>
          </div>
        )}

        {tab === "details" && (
          <div className="space-y-4">
            <ToxinPanel toxin={toxin} source={factSource} />
            <EcologyPanel ecology={ecology} source={factSource} />
            {(db?.morphology || generated.morphology) && (
              <Panel>
                <PanelHeader title="Morphology">
                  <SourceTag kind={db?.morphology ? factSource : "ai"} />
                </PanelHeader>
                <p className="text-[15px] leading-relaxed">{db?.morphology || generated.morphology}</p>
              </Panel>
            )}
            <ReferenceList references={db?.references || []} source={factSource} />
          </div>
        )}

        {tab === "compare" && (
          <ImageGallery
            images={gallery}
            emptyText="There are no curated or GBIF images for this genus yet. Approved observations become reference images."
          />
        )}

        {tab === "distribution" && <DistributionPanel gbif={gbif} />}

        {tab === "notes" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel>
              <PanelHeader title="Reasoning">
                <SourceTag kind="ai" />
              </PanelHeader>
              <p className="text-[15px] leading-relaxed">{result.analysis_notes || "No reasoning returned."}</p>
              <p className="mt-4 font-mono text-xs text-muted">Model: {result.ai_model || "unknown"}</p>
            </Panel>
            <Panel>
              <PanelHeader title="Background">
                <SourceTag kind="ai" />
              </PanelHeader>
              <dl className="space-y-4">
                {result.trivia?.discovery_history && (
                  <div>
                    <dt className="label">Discovery</dt>
                    <dd className="mt-1 text-[15px]">{result.trivia.discovery_history}</dd>
                  </div>
                )}
                {result.trivia?.fun_fact && (
                  <div>
                    <dt className="label">Did you know</dt>
                    <dd className="mt-1 text-[15px]">{result.trivia.fun_fact}</dd>
                  </div>
                )}
                {!!result.trivia?.references?.length && (
                  <div>
                    <dt className="label">Suggested reading (unverified)</dt>
                    <dd className="mt-1">
                      <ul className="list-disc space-y-1 pl-5 text-[15px]">
                        {result.trivia.references.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </dd>
                  </div>
                )}
              </dl>
            </Panel>
          </div>
        )}

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
          <Link href="/" className="inline-flex items-center gap-2 text-brand hover:underline">
            <Plus className="size-4" aria-hidden /> Identify another image
          </Link>
          {user && (
            <Link href="/workspace" className="text-sm text-muted hover:text-text">
              All my identifications
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
