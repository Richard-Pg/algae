"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, FileImage, Library, Microscope, ShieldCheck, X } from "lucide-react";
import ImagePicker from "@/components/ImagePicker";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Notice, Spinner, SpeciesName } from "@/components/ui/Primitives";
import { RiskBadge } from "@/components/ui/Tags";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { formatDate, scientificName } from "@/lib/format";
import type { PreparedImage } from "@/lib/image";
import { cacheResult } from "@/lib/resultCache";
import type { Identification, IdentificationSummary, Quota, SpeciesGroup } from "@/lib/types";

const STEPS = ["Uploading image", "Examining morphology", "Matching the species database"];

export default function IdentifyPage() {
  const router = useRouter();
  const { user, loading: authLoading, requestSignIn } = useAuth();
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [originalName, setOriginalName] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<{ message: string; rateLimited?: boolean } | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [library, setLibrary] = useState<{ total: number; groups: SpeciesGroup[] } | null>(null);
  const [recent, setRecent] = useState<IdentificationSummary[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (authLoading) return;
    api<Quota>("/api/quota").then(setQuota).catch(() => setQuota(null));
    if (user) {
      api<{ items: IdentificationSummary[] }>("/api/identifications?limit=4")
        .then((r) => setRecent(r.items))
        .catch(() => setRecent([]));
    }
  }, [user, authLoading]);

  useEffect(() => {
    api<{ total: number; groups: SpeciesGroup[] }>("/api/species", { auth: false })
      .then(setLibrary)
      .catch(() => setLibrary(null));
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const clear = () => {
    if (image?.previewUrl) URL.revokeObjectURL(image.previewUrl);
    setImage(null);
    setError(null);
  };

  const analyze = async () => {
    if (!image) return;
    setError(null);
    setAnalyzing(true);
    setStep(0);
    // The steps are indicative: the request is a single call to the server.
    timers.current = [window.setTimeout(() => setStep(1), 1200), window.setTimeout(() => setStep(2), 6500)];

    const form = new FormData();
    form.append("file", image.file, originalName || image.file.name);
    try {
      const result = await api<Identification>("/api/identify", { form });
      if (result.quota) setQuota(result.quota);
      const id = cacheResult(result, image.previewUrl);
      router.push(`/results/${id}`);
    } catch (err) {
      timers.current.forEach(clearTimeout);
      setAnalyzing(false);
      if (err instanceof ApiError && err.code === "rate_limited") {
        setError({ message: err.message, rateLimited: !user });
      } else {
        setError({ message: err instanceof Error ? err.message : "Analysis failed. Please try again." });
      }
    }
  };

  return (
    <>
      <section className="on-ink bg-ink text-ink-text">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 pt-12 pb-16 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-center lg:gap-14 lg:pt-16 lg:pb-20">
          <div>
            <p className="label">Algae &amp; diatom identification</p>
            <h1 className="mt-4 font-serif text-5xl leading-[1.02] text-white sm:text-6xl">
              What&apos;s under your <em>microscope</em>?
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-soft">
              Upload a microscope image or a bloom photo. AlgaeAI suggests the most likely genus, flags toxin risk,
              and links you to reviewed records in the open species database.
            </p>
            <ul className="mt-8 grid max-w-lg gap-3 text-sm text-ink-soft">
              {[
                "Every fact is labelled with its source: curated database, GBIF or AI estimate",
                "Harmful bloom species are flagged with what to do next",
                "Submit your observation and a reviewer adds it to the open database",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <Check className="mt-0.5 size-4 shrink-0 text-signal" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-ink-line bg-[#111d18] p-3 sm:p-4">
            {!image ? (
              <ImagePicker
                onSelect={(prepared, original) => {
                  setImage(prepared);
                  setOriginalName(original.name);
                  setError(null);
                }}
                onError={(message) => setError({ message })}
              />
            ) : (
              <div>
                <div className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-xl bg-black">
                  {image.previewUrl ? (
                    <img src={image.previewUrl} alt="Selected specimen" className="size-full object-contain" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 px-6 text-center text-ink-soft">
                      <FileImage className="size-10 text-ink-muted" aria-hidden />
                      <p className="text-sm">This browser can&apos;t preview {originalName.split(".").pop()?.toUpperCase()} files.</p>
                      <p className="text-xs text-ink-muted">It will still be analysed, and you&apos;ll see it on the result page.</p>
                    </div>
                  )}
                  {analyzing && (
                    <div className="absolute inset-0 flex items-end bg-gradient-to-t from-ink via-ink/70 to-transparent p-5">
                      <ol className="w-full space-y-2" aria-live="polite">
                        {STEPS.map((label, i) => (
                          <li
                            key={label}
                            className={`flex items-center gap-3 text-sm ${i < step ? "text-ink-soft" : i === step ? "text-white" : "text-ink-muted"}`}
                          >
                            {i < step ? (
                              <Check className="size-4 text-signal" aria-hidden />
                            ) : i === step ? (
                              <Spinner className="size-4 text-signal" />
                            ) : (
                              <span className="size-4 rounded-full border border-ink-line" aria-hidden />
                            )}
                            {label}
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <span className="min-w-0 truncate font-mono text-xs text-ink-muted">{originalName}</span>
                  <div className="flex gap-2">
                    <Button variant="ghost-ink" onClick={clear} disabled={analyzing}>
                      <X className="size-4" aria-hidden /> Change
                    </Button>
                    <Button variant="signal" onClick={analyze} disabled={analyzing}>
                      {analyzing ? "Analysing…" : "Identify"}
                      {!analyzing && <ArrowRight className="size-4" aria-hidden />}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {error && (
              <Notice
                tone={error.rateLimited ? "warning" : "error"}
                className="mt-3"
                action={
                  error.rateLimited ? (
                    <Button size="sm" onClick={() => requestSignIn("Sign in to keep identifying and to save your results.")}>
                      Sign in
                    </Button>
                  ) : undefined
                }
              >
                {error.message}
              </Notice>
            )}

            {quota && !user && (
              <p className="mt-3 px-1 text-xs text-ink-muted">
                {quota.remaining > 0
                  ? `${quota.remaining} of ${quota.limit} free identifications left today. `
                  : "You've used today's free identifications. "}
                <button type="button" className="text-signal underline-offset-2 hover:underline" onClick={() => requestSignIn("Sign in to save your results and identify more images.")}>
                  Sign in
                </button>{" "}
                to save results and identify more.
              </p>
            )}
          </div>
        </div>
      </section>

      {user && recent.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-8">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 className="text-xl font-semibold">Your recent identifications</h2>
            <Link href="/workspace" className="text-sm text-brand hover:underline">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {recent.map((item) => (
              <Link
                key={item.id}
                href={`/results/${item.id}`}
                className="group overflow-hidden rounded-xl border border-line bg-surface transition-colors hover:border-line-strong"
              >
                <div className="aspect-[4/3] bg-ink-raised">
                  {item.image_url && <img src={item.image_url} alt="" className="size-full object-cover" loading="lazy" />}
                </div>
                <div className="p-3">
                  <div className="truncate text-lg">
                    {item.identified ? <SpeciesName name={scientificName(item.genus, item.species)} /> : <span className="text-muted">Not identified</span>}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 text-xs text-muted">
                    <span>{formatDate(item.created_at)}</span>
                    {item.is_harmful && <RiskBadge level="High">HAB</RiskBadge>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-8">
        <div className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line md:grid-cols-3">
          {[
            {
              icon: Microscope,
              title: "Identify",
              body: "The vision model compares cell shape, colony form and internal structure, and lists the candidates it ruled out and why.",
            },
            {
              icon: ShieldCheck,
              title: "Check the evidence",
              body: "Taxonomy, toxins and ecology come from the curated database where we have a record, and are marked as AI estimates where we don't.",
            },
            {
              icon: Library,
              title: "Contribute",
              body: "Submit your observation with notes and references. A reviewer checks it before it joins the open species library.",
            },
          ].map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="bg-surface p-7">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-muted">0{i + 1}</span>
                <Icon className="size-5 text-brand" aria-hidden strokeWidth={1.75} />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{body}</p>
            </div>
          ))}
        </div>

        {library && library.total > 0 && (
          <div className="mt-6 flex flex-col gap-6 rounded-2xl border border-line bg-surface p-7 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="label">Open species library</p>
              <p className="mt-2 text-2xl font-semibold">
                <span className="font-mono">{library.total}</span> reviewed genera
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted">
                {library.groups
                  .filter((g) => g.count > 0)
                  .map((g) => (
                    <Link
                      key={g.id}
                      href={`/species?group=${g.id}`}
                      className="rounded-md border border-line px-2.5 py-1 hover:border-line-strong hover:text-text"
                    >
                      {g.label} <span className="font-mono">{g.count}</span>
                    </Link>
                  ))}
              </div>
            </div>
            <ButtonLink href="/species" variant="secondary">
              Browse the library <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
          </div>
        )}
      </section>
    </>
  );
}
