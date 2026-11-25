"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellOff, Check, ExternalLink, Inbox, Pencil, RotateCcw, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Field, Input, OPTIONS, Select, Textarea } from "@/components/ui/Form";
import { EmptyState, Notice, PageLoading, SpeciesName, Spinner } from "@/components/ui/Primitives";
import { SourceTag, StatusBadge, statusLabel } from "@/components/ui/Tags";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { formatDate, percent, scientificName, yesNo } from "@/lib/format";
import type { Submission, SubmissionStatus } from "@/lib/types";

const STATUSES: SubmissionStatus[] = ["pending", "needs_revision", "approved", "rejected"];

interface Queue {
  submissions: Submission[];
  counts: Record<string, number | null>;
}

interface NotificationSettings {
  enabled: boolean;
  configured: boolean;
  recipient: string;
}

type Row = { label: string; contributor?: string; ai?: string };

function comparison(s: Submission): Row[] {
  const ai = s.ai_analysis || null;
  const db = ai?.database_info || {};
  const gen = ai?.generated_details || {};
  const aiTox = db.toxin || gen.toxin || {};
  const aiEco = db.ecology || gen.ecology || {};
  const t = s.submitted_toxin || {};
  const e = s.submitted_ecology || {};
  const tax = s.submitted_taxonomy || {};
  return [
    {
      label: "Identification",
      contributor: scientificName(s.proposed_genus, s.proposed_species || ""),
      ai: ai?.identified ? `${scientificName(ai.primary_identification?.genus, ai.primary_identification?.species)} (${percent(ai.primary_identification?.confidence)})` : "Not identified",
    },
    { label: "Confidence", contributor: s.contributor_confidence || "", ai: "" },
    { label: "Morphology", contributor: s.submitted_morphology || "", ai: ai?.primary_identification?.morphological_notes || db.morphology || "" },
    { label: "Produces toxin", contributor: t.produces_toxin, ai: aiTox.produces_toxin === undefined ? "" : yesNo(aiTox.produces_toxin) },
    { label: "Toxin type", contributor: t.toxin_type, ai: aiTox.toxin_type },
    { label: "Risk level", contributor: t.risk_level, ai: aiTox.risk_level },
    { label: "Water type", contributor: e.water_type, ai: aiEco.water_type },
    { label: "Habitat", contributor: e.habitat, ai: aiEco.habitat },
    { label: "Temperature", contributor: e.temperature_range, ai: aiEco.temperature_range },
    { label: "Taxonomy", contributor: Object.values(tax).filter(Boolean).join(" › "), ai: Object.values(db.taxonomy || {}).filter(Boolean).join(" › ") },
  ].filter((r) => r.contributor || r.ai);
}

/** Flag only real disagreements: ignore blanks, "Unknown", and one value containing the other. */
function differs(a?: string, b?: string) {
  const x = (a || "").trim().toLowerCase();
  const y = (b || "").trim().toLowerCase();
  if (!x || !y || x === "unknown" || y === "unknown") return false;
  return !x.includes(y) && !y.includes(x);
}

function EditForm({ s, onSaved, onCancel }: { s: Submission; onSaved: (s: Submission) => void; onCancel: () => void }) {
  const [f, setF] = useState({
    proposed_genus: s.proposed_genus,
    proposed_species: s.proposed_species || "",
    location_found: s.location_found || "",
    sample_type: s.sample_type || "",
    microscopy_method: s.microscopy_method || "",
    submitted_morphology: s.submitted_morphology || "",
    toxin_type: s.submitted_toxin?.toxin_type || "",
    risk_level: s.submitted_toxin?.risk_level || "",
    produces_toxin: s.submitted_toxin?.produces_toxin || "",
    water_type: s.submitted_ecology?.water_type || "",
    habitat: s.submitted_ecology?.habitat || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ submission: Submission }>(`/api/admin/submissions/${s.id}`, {
        method: "PUT",
        json: {
          proposed_genus: f.proposed_genus,
          proposed_species: f.proposed_species,
          location_found: f.location_found,
          sample_type: f.sample_type,
          microscopy_method: f.microscopy_method,
          submitted_morphology: f.submitted_morphology,
          submitted_toxin: { ...(s.submitted_toxin || {}), toxin_type: f.toxin_type, risk_level: f.risk_level, produces_toxin: f.produces_toxin },
          submitted_ecology: { ...(s.submitted_ecology || {}), water_type: f.water_type, habitat: f.habitat },
        },
      });
      onSaved(r.submission);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-line bg-paper p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Genus" htmlFor="ed-genus" required><Input id="ed-genus" value={f.proposed_genus} onChange={(e) => set("proposed_genus", e.target.value)} /></Field>
        <Field label="Species epithet" htmlFor="ed-species"><Input id="ed-species" value={f.proposed_species} onChange={(e) => set("proposed_species", e.target.value)} /></Field>
        <Field label="Produces toxin" htmlFor="ed-produces"><Select id="ed-produces" options={OPTIONS.toxinPresence} value={f.produces_toxin} onChange={(e) => set("produces_toxin", e.target.value)} /></Field>
        <Field label="Risk level" htmlFor="ed-risk"><Select id="ed-risk" options={OPTIONS.riskLevel} value={f.risk_level} onChange={(e) => set("risk_level", e.target.value)} /></Field>
        <Field label="Toxin type" htmlFor="ed-toxin"><Input id="ed-toxin" value={f.toxin_type} onChange={(e) => set("toxin_type", e.target.value)} /></Field>
        <Field label="Water type" htmlFor="ed-water"><Select id="ed-water" options={OPTIONS.waterType} value={f.water_type} onChange={(e) => set("water_type", e.target.value)} /></Field>
        <Field label="Habitat" htmlFor="ed-habitat"><Input id="ed-habitat" value={f.habitat} onChange={(e) => set("habitat", e.target.value)} /></Field>
        <Field label="Location" htmlFor="ed-location"><Input id="ed-location" value={f.location_found} onChange={(e) => set("location_found", e.target.value)} /></Field>
        <Field label="Sample type" htmlFor="ed-sample"><Select id="ed-sample" options={OPTIONS.sampleType} value={f.sample_type} onChange={(e) => set("sample_type", e.target.value)} /></Field>
        <Field label="Microscopy" htmlFor="ed-micro"><Select id="ed-micro" options={OPTIONS.microscopy} value={f.microscopy_method} onChange={(e) => set("microscopy_method", e.target.value)} /></Field>
        <Field label="Morphology" htmlFor="ed-morph" className="sm:col-span-2"><Textarea id="ed-morph" rows={3} value={f.submitted_morphology} onChange={(e) => set("submitted_morphology", e.target.value)} /></Field>
      </div>
      {error && <Notice tone="error" className="mt-3">{error}</Notice>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save edits"}</Button>
      </div>
    </div>
  );
}

function Detail({ s, onReviewed, onUpdated }: { s: Submission; onReviewed: (msg: string) => void; onUpdated: (s: Submission) => void }) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reviewable = s.status === "pending" || s.status === "needs_revision";

  useEffect(() => {
    setNotes("");
    setEditing(false);
    setError(null);
  }, [s.id]);

  const act = async (action: "approve" | "reject" | "request-revision") => {
    if (action === "request-revision" && !notes.trim()) {
      setError("Write what the contributor should change before returning it.");
      return;
    }
    setBusy(action);
    setError(null);
    try {
      const r = await api<{ message: string }>(`/api/admin/submissions/${s.id}/${action}`, { json: { admin_notes: notes } });
      onReviewed(r.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
    }
  };

  const rows = comparison(s);
  return (
    <article className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <SpeciesName name={scientificName(s.proposed_genus, s.proposed_species || "")} className="text-4xl" />
            <StatusBadge status={s.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {s.user_name || "Unknown contributor"}
            {s.user_email ? ` · ${s.user_email}` : ""} · submitted {formatDate(s.created_at, true)}
          </p>
        </div>
        {reviewable && !editing && (
          <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="size-4" aria-hidden /> Edit fields
          </Button>
        )}
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <div>
          <a href={s.image_url || "#"} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-xl bg-ink">
            {s.image_url && <img src={s.image_url} alt="Submitted specimen" className="size-full object-contain" />}
          </a>
          <dl className="mt-4 space-y-2 text-sm">
            {[
              ["Location", s.location_found],
              ["Collected", s.collection_date],
              ["Sample", s.sample_type],
              ["Microscopy", s.microscopy_method],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right">{v || "—"}</dd>
              </div>
            ))}
          </dl>
          {s.identification_id && (
            <Link href={`/results/${s.identification_id}`} className="mt-3 inline-flex items-center gap-1 text-sm text-brand hover:underline">
              Original identification <ExternalLink className="size-3.5" aria-hidden />
            </Link>
          )}
        </div>

        <div className="min-w-0 space-y-5">
          {editing ? (
            <EditForm
              s={s}
              onCancel={() => setEditing(false)}
              onSaved={(u) => {
                setEditing(false);
                onUpdated({ ...s, ...u });
              }}
            />
          ) : (
            <div className="overflow-hidden rounded-xl border border-line">
              <table className="w-full text-left text-sm">
                <thead className="bg-paper">
                  <tr>
                    <th scope="col" className="w-32 px-3 py-2 font-medium text-muted">Field</th>
                    <th scope="col" className="px-3 py-2"><SourceTag kind="contributor" /></th>
                    <th scope="col" className="px-3 py-2"><SourceTag kind="ai" label="AI / database" /></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => {
                    const diff = differs(r.contributor, r.ai);
                    return (
                      <tr key={r.label} className={diff ? "bg-risk-medium-tint/60" : ""}>
                        <th scope="row" className="px-3 py-2.5 align-top font-normal text-muted">
                          {r.label}
                          {diff && <span className="mt-0.5 block text-[11px] text-risk-medium">differs</span>}
                        </th>
                        <td className="px-3 py-2.5 align-top">{r.contributor || <span className="text-muted">—</span>}</td>
                        <td className="px-3 py-2.5 align-top text-[#2b3631]">{r.ai || <span className="text-muted">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {s.user_notes && (
            <div>
              <div className="label">Contributor notes</div>
              <p className="mt-1 text-[15px] leading-relaxed whitespace-pre-line">{s.user_notes}</p>
            </div>
          )}
          {!!s.submitted_references?.length && (
            <div>
              <div className="label">References</div>
              <ul className="mt-1 space-y-1 text-sm">
                {s.submitted_references.map((r, i) => (
                  <li key={i}>
                    {r.url && /^https?:/.test(r.url) ? (
                      <a href={r.url} target="_blank" rel="noreferrer" className="break-all text-brand hover:underline">{r.label || r.url}</a>
                    ) : (
                      r.label || r.url
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {s.admin_notes && (
            <div className="rounded-lg bg-paper p-3 text-sm">
              <span className="label">Previous reviewer notes</span>
              <p className="mt-1">{s.admin_notes}</p>
            </div>
          )}
        </div>
      </div>

      {reviewable && (
        <section aria-label="Review decision" className="rounded-xl border border-line bg-surface p-5">
          <Field label="Note to the contributor" htmlFor="review-notes" hint="Sent by email and shown in their workspace. Required when asking for a revision.">
            <Textarea id="review-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          {error && <Notice tone="error" className="mt-3">{error}</Notice>}
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="danger" onClick={() => act("reject")} disabled={Boolean(busy)}>
              <X className="size-4" aria-hidden /> {busy === "reject" ? "Rejecting…" : "Reject"}
            </Button>
            <Button variant="secondary" onClick={() => act("request-revision")} disabled={Boolean(busy)}>
              <RotateCcw className="size-4" aria-hidden /> {busy === "request-revision" ? "Sending…" : "Request revision"}
            </Button>
            <Button onClick={() => act("approve")} disabled={Boolean(busy)}>
              <Check className="size-4" aria-hidden /> {busy === "approve" ? "Approving…" : "Approve & publish"}
            </Button>
          </div>
        </section>
      )}
    </article>
  );
}

export default function AdminPage() {
  const { user, loading, meLoading, isAdmin, requestSignIn } = useAuth();
  const [status, setStatus] = useState<SubmissionStatus>("pending");
  const [queue, setQueue] = useState<Queue | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [notify, setNotify] = useState<NotificationSettings | null>(null);
  const [notifyBusy, setNotifyBusy] = useState(false);

  const load = useCallback(async (s: SubmissionStatus) => {
    setQueue(null);
    setError(null);
    try {
      const q = await api<Queue>(`/api/admin/submissions?status=${s}`);
      setQueue(q);
      setSelectedId((cur) => (q.submissions.some((x) => x.id === cur) ? cur : q.submissions[0]?.id ?? null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load the queue.");
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    load(status);
  }, [isAdmin, status, load]);

  useEffect(() => {
    if (!isAdmin) return;
    api<NotificationSettings>("/api/admin/notification-settings").then(setNotify).catch(() => setNotify(null));
  }, [isAdmin]);

  if (loading || meLoading) return <PageLoading />;
  if (!user || !isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <EmptyState
          icon={<ShieldAlert className="size-8" aria-hidden />}
          title="Reviewers only"
          action={!user ? <Button onClick={() => requestSignIn("Sign in with a reviewer account.")}>Sign in</Button> : undefined}
        >
          The review queue is available to accounts listed as reviewers on the server (ADMIN_EMAILS).
        </EmptyState>
      </div>
    );
  }

  const selected = queue?.submissions.find((s) => s.id === selectedId) || null;

  const toggleNotify = async () => {
    if (!notify) return;
    setNotifyBusy(true);
    try {
      setNotify(await api<NotificationSettings>("/api/admin/notification-settings", { method: "PUT", json: { enabled: !notify.enabled } }));
    } finally {
      setNotifyBusy(false);
    }
  };

  return (
    <>
      <section className="on-ink bg-ink text-ink-text">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4 px-4 pt-10 pb-6 sm:px-8">
          <div>
            <p className="label">Review queue</p>
            <h1 className="mt-2 font-serif text-5xl text-white">Community observations</h1>
          </div>
          {notify && (
            <button
              type="button"
              onClick={toggleNotify}
              disabled={notifyBusy}
              title={notify.configured ? `Alerts go to ${notify.recipient}` : "SMTP isn't configured on the server yet"}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-ink-line px-3 text-sm text-ink-soft hover:border-ink-muted hover:text-white"
            >
              {notify.enabled ? <Bell className="size-4 text-signal" aria-hidden /> : <BellOff className="size-4" aria-hidden />}
              Email alerts {notify.enabled ? "on" : "off"}
              {!notify.configured && <span className="text-xs text-risk-high-on-ink">(SMTP not set)</span>}
            </button>
          )}
        </div>
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <div role="tablist" aria-label="Status" className="flex gap-6 overflow-x-auto">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={status === s}
                onClick={() => setStatus(s)}
                className={`-mb-px flex min-h-12 shrink-0 items-center gap-2 border-b-2 text-[15px] ${status === s ? "border-signal text-white" : "border-transparent text-ink-soft hover:text-white"}`}
              >
                {statusLabel[s]}
                <span className="rounded bg-ink-raised px-1.5 font-mono text-xs text-ink-soft">{queue?.counts?.[s] ?? "·"}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
        {flash && (
          <Notice tone="success" className="mb-4" action={<Button size="sm" variant="ghost" onClick={() => setFlash(null)}>Dismiss</Button>}>
            {flash}
          </Notice>
        )}
        {error && <Notice tone="error" className="mb-4">{error}</Notice>}
        {!queue && !error && <div className="flex justify-center py-16 text-muted"><Spinner /></div>}

        {queue && queue.submissions.length === 0 && (
          <EmptyState icon={<Inbox className="size-8" aria-hidden />} title={`Nothing ${statusLabel[status].toLowerCase()}`}>
            {status === "pending" ? "New observations will appear here." : "No submissions have this status."}
          </EmptyState>
        )}

        {queue && queue.submissions.length > 0 && (
          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
            <ul className="max-h-[calc(100vh-14rem)] self-start divide-y divide-line overflow-y-auto rounded-xl border border-line bg-surface lg:sticky lg:top-20">
              {queue.submissions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    aria-current={s.id === selectedId}
                    className={`flex w-full items-center gap-3 p-3 text-left ${s.id === selectedId ? "bg-brand-tint" : "hover:bg-paper"}`}
                  >
                    <span className="size-12 shrink-0 overflow-hidden rounded-md bg-ink-raised">
                      {s.image_url && <img src={s.image_url} alt="" className="size-full object-cover" loading="lazy" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <SpeciesName name={scientificName(s.proposed_genus, s.proposed_species || "")} className="block truncate text-lg leading-tight" />
                      <span className="block truncate text-xs text-muted">
                        {s.user_name || "Unknown"} · {formatDate(s.created_at)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="min-w-0 rounded-xl border border-line bg-surface p-5 sm:p-6">
              {selected ? (
                <Detail
                  s={selected}
                  onReviewed={(msg) => {
                    setFlash(msg);
                    load(status);
                  }}
                  onUpdated={(u) => setQueue((q) => (q ? { ...q, submissions: q.submissions.map((x) => (x.id === u.id ? u : x)) } : q))}
                />
              ) : (
                <p className="text-muted">Select a submission.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
