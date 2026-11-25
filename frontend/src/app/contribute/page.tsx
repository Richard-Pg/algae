"use client";

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, FileImage, Plus, Send, Trash2, X } from "lucide-react";
import ImagePicker from "@/components/ImagePicker";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, Input, OPTIONS, Select, Textarea } from "@/components/ui/Form";
import { EmptyState, Notice, PageLoading, Panel, SpeciesName } from "@/components/ui/Primitives";
import { StatusBadge } from "@/components/ui/Tags";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { scientificName, shortId } from "@/lib/format";
import type { PreparedImage } from "@/lib/image";
import type { Identification, Reference, Submission } from "@/lib/types";

interface FormState {
  proposed_genus: string;
  proposed_species: string;
  contributor_confidence: string;
  submitted_morphology: string;
  toxin: { produces_toxin: string; toxin_type: string; risk_level: string; health_effects: string };
  ecology: { habitat: string; water_type: string; bloom_conditions: string; temperature_range: string; indicator_of: string };
  taxonomy: { kingdom: string; phylum: string; class: string; order: string; family: string };
  references: Reference[];
  collection_date: string;
  location_found: string;
  sample_type: string;
  microscopy_method: string;
  user_notes: string;
}

const EMPTY: FormState = {
  proposed_genus: "",
  proposed_species: "",
  contributor_confidence: "",
  submitted_morphology: "",
  toxin: { produces_toxin: "", toxin_type: "", risk_level: "", health_effects: "" },
  ecology: { habitat: "", water_type: "", bloom_conditions: "", temperature_range: "", indicator_of: "" },
  taxonomy: { kingdom: "", phylum: "", class: "", order: "", family: "" },
  references: [{ label: "", url: "" }],
  collection_date: "",
  location_found: "",
  sample_type: "",
  microscopy_method: "",
  user_notes: "",
};

const DRAFT_KEY = "algaeai:contribute-draft";
const STEPS = ["Specimen", "Evidence", "Collection", "Review"];

const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));
const epithet = (genus: string, species?: string) => {
  const s = (species || "").trim();
  if (!s || /^spp?\.?$/i.test(s)) return "";
  return s.toLowerCase().startsWith(genus.toLowerCase() + " ") ? s.slice(genus.length + 1) : s;
};

function fromIdentification(r: Identification): FormState {
  const db = r.database_info || {};
  const gen = r.generated_details || {};
  const toxin = db.toxin || gen.toxin || {};
  const eco = db.ecology || gen.ecology || {};
  const tax = db.taxonomy || {};
  const genus = r.primary_identification?.genus || "";
  return {
    ...EMPTY,
    proposed_genus: genus,
    proposed_species: epithet(genus, r.primary_identification?.species),
    submitted_morphology: r.primary_identification?.morphological_notes || "",
    toxin: {
      produces_toxin: toxin.produces_toxin === true ? "Yes" : toxin.produces_toxin === false ? "No" : str(toxin.produces_toxin),
      toxin_type: str(toxin.toxin_type) === "None" ? "" : str(toxin.toxin_type),
      risk_level: str(toxin.risk_level),
      health_effects: str(toxin.health_effects),
    },
    ecology: {
      habitat: str(eco.habitat),
      water_type: str(eco.water_type),
      bloom_conditions: str(eco.bloom_conditions),
      temperature_range: str(eco.temperature_range),
      indicator_of: str(eco.indicator_of),
    },
    taxonomy: {
      kingdom: str(tax.kingdom),
      phylum: str(tax.phylum),
      class: str(tax.class),
      order: str(tax.order),
      family: str(tax.family),
    },
  };
}

function fromSubmission(s: Submission): FormState {
  const d = (o: Record<string, string> | null | undefined, k: string) => str(o?.[k]);
  return {
    proposed_genus: s.proposed_genus || "",
    proposed_species: s.proposed_species || "",
    contributor_confidence: s.contributor_confidence || "",
    submitted_morphology: s.submitted_morphology || "",
    toxin: {
      produces_toxin: d(s.submitted_toxin, "produces_toxin"),
      toxin_type: d(s.submitted_toxin, "toxin_type"),
      risk_level: d(s.submitted_toxin, "risk_level"),
      health_effects: d(s.submitted_toxin, "health_effects"),
    },
    ecology: {
      habitat: d(s.submitted_ecology, "habitat"),
      water_type: d(s.submitted_ecology, "water_type"),
      bloom_conditions: d(s.submitted_ecology, "bloom_conditions"),
      temperature_range: d(s.submitted_ecology, "temperature_range"),
      indicator_of: d(s.submitted_ecology, "indicator_of"),
    },
    taxonomy: {
      kingdom: d(s.submitted_taxonomy, "kingdom"),
      phylum: d(s.submitted_taxonomy, "phylum"),
      class: d(s.submitted_taxonomy, "class"),
      order: d(s.submitted_taxonomy, "order"),
      family: d(s.submitted_taxonomy, "family"),
    },
    references: s.submitted_references?.length ? s.submitted_references : [{ label: "", url: "" }],
    collection_date: s.collection_date || "",
    location_found: s.location_found || "",
    sample_type: s.sample_type || "",
    microscopy_method: s.microscopy_method || "",
    user_notes: s.user_notes || "",
  };
}

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="border-t border-line pt-6 first:border-t-0 first:pt-0">
      <legend className="text-lg font-semibold">{title}</legend>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </fieldset>
  );
}

function ContributeContent() {
  const { user, loading: authLoading, requestSignIn } = useAuth();
  const params = useSearchParams();
  const fromId = params.get("from");
  const editId = params.get("edit");

  const [form, setForm] = useState<FormState>(EMPTY);
  const [step, setStep] = useState(0);
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [originalName, setOriginalName] = useState("");
  const [source, setSource] = useState<Identification | null>(null);
  const [useSource, setUseSource] = useState(true);
  const [editing, setEditing] = useState<Submission | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [loading, setLoading] = useState(Boolean(fromId || editId));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<"created" | "updated" | null>(null);

  // Load whatever the form starts from.
  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    (async () => {
      try {
        if (editId) {
          const mine = await api<{ items: Submission[] }>("/api/submissions/mine");
          const s = mine.items.find((i) => i.id === editId);
          if (!s) throw new Error("That submission wasn't found in your contributions.");
          if (!cancelled) {
            setEditing(s);
            setForm(fromSubmission(s));
          }
        } else if (fromId) {
          const r = await api<Identification>(`/api/identifications/${encodeURIComponent(fromId)}`);
          if (!cancelled) {
            setSource(r);
            setForm(fromIdentification(r));
            setPrefilled(true);
          }
        } else {
          const genus = params.get("genus") || "";
          const species = params.get("species") || "";
          const raw = localStorage.getItem(DRAFT_KEY);
          if (raw && raw !== JSON.stringify(EMPTY) && !genus) {
            setForm({ ...EMPTY, ...JSON.parse(raw) });
            setDraftRestored(true);
          } else if (genus) {
            setForm({ ...EMPTY, proposed_genus: genus, proposed_species: epithet(genus, species) });
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load the form.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, fromId, editId]);

  // Autosave new submissions (not the image) so nothing is lost.
  useEffect(() => {
    if (editId || fromId || loading || done) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
      } catch {
        /* ignore */
      }
    }, 600);
    return () => clearTimeout(t);
  }, [form, editId, fromId, loading, done]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setIn = <K extends "toxin" | "ecology" | "taxonomy">(key: K, field: keyof FormState[K], value: string) =>
    setForm((f) => ({ ...f, [key]: { ...f[key], [field]: value } }));

  const hasImage = Boolean(editing) || (source && useSource) || Boolean(image);
  const stepError = useMemo(() => {
    if (step === 0) {
      if (!hasImage) return "Add an image of the specimen.";
      if (!form.proposed_genus.trim()) return "Enter the genus you believe this is.";
    }
    if (step === 1) {
      const bad = form.references.find((r) => r.url && !/^(https?:\/\/|doi:|10\.)/i.test(r.url.trim()));
      if (bad) return "References should be a web link or a DOI.";
    }
    return null;
  }, [step, hasImage, form]);

  const [showStepError, setShowStepError] = useState(false);
  const next = () => {
    if (stepError) return setShowStepError(true);
    setShowStepError(false);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const back = () => {
    setShowStepError(false);
    setStep((s) => Math.max(0, s - 1));
  };

  const payload = () => ({
    proposed_genus: form.proposed_genus.trim(),
    proposed_species: form.proposed_species.trim(),
    contributor_confidence: form.contributor_confidence,
    submitted_morphology: form.submitted_morphology,
    submitted_toxin: form.toxin,
    submitted_ecology: form.ecology,
    submitted_taxonomy: form.taxonomy,
    submitted_references: form.references.filter((r) => (r.url || r.label || "").trim()),
    collection_date: form.collection_date,
    location_found: form.location_found,
    sample_type: form.sample_type,
    microscopy_method: form.microscopy_method,
    user_notes: form.user_notes,
  });

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (editing) {
        await api(`/api/submissions/${editing.id}`, { method: "PUT", json: payload() });
        setDone("updated");
      } else {
        const data = new FormData();
        const p = payload();
        Object.entries(p).forEach(([k, v]) => data.append(k, typeof v === "string" ? v : JSON.stringify(v)));
        if (source && useSource && source.id) data.append("identification_id", source.id);
        else if (image) data.append("file", image.file, originalName || image.file.name);
        await api("/api/submissions", { form: data });
        localStorage.removeItem(DRAFT_KEY);
        setDone("created");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    localStorage.removeItem(DRAFT_KEY);
    setForm(EMPTY);
    setImage(null);
    setDraftRestored(false);
    setStep(0);
  };

  if (authLoading) return <PageLoading />;
  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <EmptyState
          title="Sign in to contribute"
          action={<Button onClick={() => requestSignIn("Sign in to submit observations to the open database.")}>Sign in</Button>}
        >
          Observations are reviewed before they join the open species library, and approved ones are credited to you.
        </EmptyState>
      </div>
    );
  }
  if (loading) return <PageLoading />;

  if (done) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <EmptyState
          icon={<Check className="size-9 text-brand" aria-hidden />}
          title={done === "created" ? "Observation submitted" : "Changes sent for review"}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <ButtonLink href="/workspace?tab=contributions">Track it in your workspace</ButtonLink>
              <ButtonLink href="/" variant="secondary">Identify another image</ButtonLink>
            </div>
          }
        >
          A reviewer will check it and you&apos;ll get an email when it&apos;s approved, returned for changes, or declined.
        </EmptyState>
      </div>
    );
  }

  const imagePreview = editing?.image_url || (source && useSource ? source.image_url : image?.previewUrl) || null;
  const name = scientificName(form.proposed_genus, form.proposed_species);

  return (
    <>
      <section className="on-ink bg-ink text-ink-text">
        <div className="mx-auto max-w-5xl px-4 pt-10 pb-8 sm:px-8">
          <p className="label">{editing ? "Revise your observation" : "Contribute to the open database"}</p>
          <h1 className="mt-3 font-serif text-5xl text-white">{editing ? "Update and resubmit" : "Submit an observation"}</h1>
          <ol className="mt-8 grid grid-cols-4 gap-2" aria-label="Progress">
            {STEPS.map((label, i) => (
              <li key={label} aria-current={i === step ? "step" : undefined}>
                <div className={`h-1 rounded-full ${i <= step ? "bg-signal" : "bg-ink-line"}`} />
                <div className={`mt-2 text-sm ${i === step ? "text-white" : "text-ink-muted"}`}>
                  <span className="font-mono text-xs">0{i + 1}</span> <span className="hidden sm:inline">{label}</span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        {editing?.status === "needs_revision" && editing.admin_notes && (
          <Notice tone="warning" title="The reviewer asked for changes" className="mb-6">
            {editing.admin_notes}
          </Notice>
        )}
        {prefilled && step < 3 && (
          <Notice tone="info" title="Prefilled from your identification" className="mb-6">
            Fields come from the AI result and the curated database. Check and correct them — your submission should
            describe what you observed.
          </Notice>
        )}
        {draftRestored && step === 0 && (
          <Notice
            tone="info"
            className="mb-6"
            action={<Button size="sm" variant="secondary" onClick={reset}>Start over</Button>}
          >
            We restored the draft you were working on. Add the image again to continue.
          </Notice>
        )}

        <Panel className="p-6 sm:p-8">
          {step === 0 && (
            <div className="space-y-8">
              <Section title="Specimen image" hint="A clear image showing the features you used to identify it.">
                {editing ? (
                  <div className="flex items-center gap-4">
                    <div className="size-28 overflow-hidden rounded-lg bg-ink-raised">
                      {editing.image_url && <img src={editing.image_url} alt="Submitted specimen" className="size-full object-cover" />}
                    </div>
                    <p className="text-sm text-muted">The image can&apos;t be changed on a revision. Submit a new observation for a different image.</p>
                  </div>
                ) : source && useSource ? (
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="size-28 overflow-hidden rounded-lg bg-ink-raised">
                      {source.image_url && <img src={source.image_url} alt="From your identification" className="size-full object-cover" />}
                    </div>
                    <div className="text-sm">
                      <p>
                        From identification <span className="font-mono">{shortId(source.id)}</span>
                      </p>
                      <button type="button" className="mt-1 text-brand hover:underline" onClick={() => setUseSource(false)}>
                        Use a different image
                      </button>
                    </div>
                  </div>
                ) : image ? (
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="grid size-28 place-items-center overflow-hidden rounded-lg bg-ink-raised">
                      {image.previewUrl ? <img src={image.previewUrl} alt="Selected specimen" className="size-full object-cover" /> : <FileImage className="size-8 text-ink-muted" aria-hidden />}
                    </div>
                    <div className="text-sm">
                      <p className="font-mono text-xs text-muted">{originalName}</p>
                      <button type="button" className="mt-1 inline-flex items-center gap-1 text-brand hover:underline" onClick={() => setImage(null)}>
                        <X className="size-3.5" aria-hidden /> Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <ImagePicker
                    tone="light"
                    compact
                    onSelect={(p, original) => {
                      setImage(p);
                      setOriginalName(original.name);
                    }}
                    onError={setError}
                  />
                )}
              </Section>

              <Section title="Your identification">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Genus" htmlFor="genus" required>
                    <Input id="genus" value={form.proposed_genus} onChange={(e) => set("proposed_genus", e.target.value)} placeholder="e.g. Microcystis" />
                  </Field>
                  <Field label="Species epithet" htmlFor="species" hint="Leave empty if you're only sure of the genus.">
                    <Input id="species" value={form.proposed_species} onChange={(e) => set("proposed_species", e.target.value)} placeholder="e.g. aeruginosa" />
                  </Field>
                  <Field label="How confident are you?" htmlFor="confidence">
                    <Select id="confidence" options={OPTIONS.confidence} value={form.contributor_confidence} onChange={(e) => set("contributor_confidence", e.target.value)} />
                  </Field>
                </div>
              </Section>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-8">
              <Section title="Morphology" hint="What you can see: cell shape and size, colony form, chloroplasts, valve or raphe features.">
                <Textarea
                  id="morphology"
                  aria-label="Morphology notes"
                  rows={4}
                  value={form.submitted_morphology}
                  onChange={(e) => set("submitted_morphology", e.target.value)}
                />
              </Section>
              <Section title="Toxicity">
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Produces toxin?" htmlFor="tox-produces">
                    <Select id="tox-produces" options={OPTIONS.toxinPresence} value={form.toxin.produces_toxin} onChange={(e) => setIn("toxin", "produces_toxin", e.target.value)} />
                  </Field>
                  <Field label="Toxin type" htmlFor="tox-type">
                    <Input id="tox-type" value={form.toxin.toxin_type} onChange={(e) => setIn("toxin", "toxin_type", e.target.value)} placeholder="e.g. microcystin" />
                  </Field>
                  <Field label="Risk level" htmlFor="tox-risk">
                    <Select id="tox-risk" options={OPTIONS.riskLevel} value={form.toxin.risk_level} onChange={(e) => setIn("toxin", "risk_level", e.target.value)} />
                  </Field>
                  <Field label="Health effects" htmlFor="tox-effects" className="sm:col-span-3">
                    <Input id="tox-effects" value={form.toxin.health_effects} onChange={(e) => setIn("toxin", "health_effects", e.target.value)} />
                  </Field>
                </div>
              </Section>
              <Section title="Ecology">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Habitat" htmlFor="eco-habitat">
                    <Input id="eco-habitat" value={form.ecology.habitat} onChange={(e) => setIn("ecology", "habitat", e.target.value)} />
                  </Field>
                  <Field label="Water type" htmlFor="eco-water">
                    <Select id="eco-water" options={OPTIONS.waterType} value={form.ecology.water_type} onChange={(e) => setIn("ecology", "water_type", e.target.value)} />
                  </Field>
                  <Field label="Temperature range" htmlFor="eco-temp">
                    <Input id="eco-temp" value={form.ecology.temperature_range} onChange={(e) => setIn("ecology", "temperature_range", e.target.value)} placeholder="e.g. 20–30 °C" />
                  </Field>
                  <Field label="Indicator of" htmlFor="eco-indicator">
                    <Input id="eco-indicator" value={form.ecology.indicator_of} onChange={(e) => setIn("ecology", "indicator_of", e.target.value)} />
                  </Field>
                  <Field label="Bloom conditions" htmlFor="eco-bloom" className="sm:col-span-2">
                    <Input id="eco-bloom" value={form.ecology.bloom_conditions} onChange={(e) => setIn("ecology", "bloom_conditions", e.target.value)} />
                  </Field>
                </div>
              </Section>
              <Section title="Taxonomy">
                <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {(["kingdom", "phylum", "class", "order", "family"] as const).map((rank) => (
                    <Field key={rank} label={rank[0].toUpperCase() + rank.slice(1)} htmlFor={`tax-${rank}`}>
                      <Input id={`tax-${rank}`} value={form.taxonomy[rank]} onChange={(e) => setIn("taxonomy", rank, e.target.value)} />
                    </Field>
                  ))}
                </div>
              </Section>
              <Section title="References" hint="AlgaeBase, GBIF, WoRMS, NCBI, a paper's DOI, or course material.">
                <div className="space-y-3">
                  {form.references.map((ref, i) => (
                    <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto]">
                      <Input
                        aria-label={`Reference ${i + 1} title`}
                        placeholder="Title (optional)"
                        value={ref.label || ""}
                        onChange={(e) => set("references", form.references.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))}
                      />
                      <Input
                        aria-label={`Reference ${i + 1} link or DOI`}
                        placeholder="https://… or DOI"
                        value={ref.url || ""}
                        onChange={(e) => set("references", form.references.map((r, j) => (j === i ? { ...r, url: e.target.value } : r)))}
                      />
                      <Button
                        variant="ghost"
                        aria-label={`Remove reference ${i + 1}`}
                        onClick={() => set("references", form.references.length > 1 ? form.references.filter((_, j) => j !== i) : [{ label: "", url: "" }])}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  ))}
                  <Button variant="secondary" size="sm" onClick={() => set("references", [...form.references, { label: "", url: "" }])}>
                    <Plus className="size-4" aria-hidden /> Add reference
                  </Button>
                </div>
              </Section>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8">
              <Section title="Where and when" hint="Location is shown publicly with approved observations, so keep it as precise as you're comfortable with.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Location" htmlFor="location" className="sm:col-span-2">
                    <Input id="location" value={form.location_found} onChange={(e) => set("location_found", e.target.value)} placeholder="e.g. Utah Lake, Utah, USA — eastern shore" />
                  </Field>
                  <Field label="Collection date" htmlFor="date">
                    <Input id="date" type="date" value={form.collection_date} onChange={(e) => set("collection_date", e.target.value)} />
                  </Field>
                  <Field label="Sample type" htmlFor="sample">
                    <Select id="sample" options={OPTIONS.sampleType} value={form.sample_type} onChange={(e) => set("sample_type", e.target.value)} />
                  </Field>
                  <Field label="Microscopy method" htmlFor="microscopy">
                    <Select id="microscopy" options={OPTIONS.microscopy} value={form.microscopy_method} onChange={(e) => set("microscopy_method", e.target.value)} />
                  </Field>
                </div>
              </Section>
              <Section title="Notes for the reviewer" hint="Why you think it's this taxon, and anything unusual you noticed.">
                <Textarea id="notes" aria-label="Notes for the reviewer" rows={5} value={form.user_notes} onChange={(e) => set("user_notes", e.target.value)} />
              </Section>
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-8 md:grid-cols-[12rem_minmax(0,1fr)]">
              <div className="aspect-square overflow-hidden rounded-xl bg-ink-raised">
                {imagePreview && <img src={imagePreview} alt="Specimen" className="size-full object-cover" />}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <SpeciesName name={name} className="text-4xl" />
                  {editing && <StatusBadge status={editing.status} />}
                </div>
                <dl className="mt-5 grid gap-x-6 gap-y-3 text-[15px] sm:grid-cols-[10rem_minmax(0,1fr)]">
                  {[
                    ["Your confidence", form.contributor_confidence],
                    ["Morphology", form.submitted_morphology],
                    ["Toxin", [form.toxin.produces_toxin && `Produces: ${form.toxin.produces_toxin}`, form.toxin.toxin_type, form.toxin.risk_level && `${form.toxin.risk_level} risk`].filter(Boolean).join(" · ")],
                    ["Ecology", [form.ecology.water_type, form.ecology.habitat, form.ecology.temperature_range].filter(Boolean).join(" · ")],
                    ["Taxonomy", Object.values(form.taxonomy).filter(Boolean).join(" › ")],
                    ["References", form.references.filter((r) => r.url || r.label).length ? `${form.references.filter((r) => r.url || r.label).length} added` : ""],
                    ["Location", form.location_found],
                    ["Collected", [form.collection_date, form.sample_type, form.microscopy_method].filter(Boolean).join(" · ")],
                    ["Notes", form.user_notes],
                  ].map(([label, value]) => (
                    <div key={label} className="contents">
                      <dt className="text-muted">{label}</dt>
                      <dd className={value ? "" : "text-muted"}>{value || "—"}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-6 text-sm text-muted">
                  If approved, the image, your display name, and the location become public in the species library.
                </p>
              </div>
            </div>
          )}

          {showStepError && stepError && (
            <Notice tone="error" className="mt-6">
              {stepError}
            </Notice>
          )}
          {error && (
            <Notice tone="error" className="mt-6">
              {error}
            </Notice>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
            {step > 0 ? (
              <Button variant="secondary" onClick={back}>
                <ArrowLeft className="size-4" aria-hidden /> Back
              </Button>
            ) : (
              <Link href={editing ? "/workspace?tab=contributions" : "/"} className="text-sm text-muted hover:text-text">
                Cancel
              </Link>
            )}
            {step < STEPS.length - 1 ? (
              <Button onClick={next}>
                Continue <ArrowRight className="size-4" aria-hidden />
              </Button>
            ) : (
              <Button onClick={submit} disabled={busy}>
                <Send className="size-4" aria-hidden /> {busy ? "Submitting…" : editing ? "Resubmit for review" : "Submit for review"}
              </Button>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}

export default function ContributePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <ContributeContent />
    </Suspense>
  );
}
