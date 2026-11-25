"use client";

import { Suspense, useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Link2, Microscope, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { EmptyState, Notice, PageLoading, Panel, SpeciesName, Spinner } from "@/components/ui/Primitives";
import { RiskBadge, StatusBadge } from "@/components/ui/Tags";
import { Tabs } from "@/components/ui/Tabs";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import { formatDate, percent, scientificName } from "@/lib/format";
import type { IdentificationSummary, Submission } from "@/lib/types";

type TabId = "identifications" | "contributions" | "profile";
const PAGE = 24;

function Identifications() {
  const [items, setItems] = useState<IdentificationSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [harmfulOnly, setHarmfulOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (offset: number) => {
      setLoading(true);
      try {
        const r = await api<{ items: IdentificationSummary[]; total: number }>(
          `/api/identifications?limit=${PAGE}&offset=${offset}${harmfulOnly ? "&harmful=true" : ""}`,
        );
        setItems((prev) => (offset === 0 ? r.items : [...prev, ...r.items]));
        setTotal(r.total);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load your identifications.");
      } finally {
        setLoading(false);
      }
    },
    [harmfulOnly],
  );

  useEffect(() => {
    load(0);
  }, [load]);

  const remove = async (id: string) => {
    if (!window.confirm("Delete this identification and its image? This can't be undone.")) return;
    await api(`/api/identifications/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
    setTotal((t) => t - 1);
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-line bg-surface p-1 text-sm" role="group" aria-label="Filter">
          {[
            { label: "All", value: false },
            { label: "Harmful species", value: true },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              aria-pressed={harmfulOnly === opt.value}
              onClick={() => setHarmfulOnly(opt.value)}
              className={`rounded-md px-3 py-1.5 ${harmfulOnly === opt.value ? "bg-ink text-white" : "text-muted hover:text-text"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <span className="text-sm text-muted">
          <span className="font-mono text-text">{total}</span> {total === 1 ? "result" : "results"}
        </span>
      </div>

      {error && <Notice tone="error" className="mb-4">{error}</Notice>}

      {!loading && items.length === 0 && !error ? (
        <EmptyState
          icon={<Microscope className="size-8" aria-hidden />}
          title={harmfulOnly ? "No harmful species found" : "No identifications yet"}
          action={<ButtonLink href="/"><Plus className="size-4" aria-hidden /> Identify an image</ButtonLink>}
        >
          {harmfulOnly ? "None of your results were flagged as harmful bloom species." : "Your results are saved here automatically."}
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <li key={item.id} className="group relative overflow-hidden rounded-xl border border-line bg-surface hover:border-line-strong">
              <Link href={`/results/${item.id}`} className="block">
                <div className="aspect-[4/3] bg-ink-raised">
                  {item.image_url && <img src={item.image_url} alt="" loading="lazy" className="size-full object-cover" />}
                </div>
                <div className="p-4">
                  <div className="truncate text-xl leading-tight">
                    {item.identified ? (
                      <SpeciesName name={scientificName(item.genus, item.species)} />
                    ) : (
                      <span className="text-base text-muted">Not identified</span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted">
                    <span>{formatDate(item.created_at, true)}</span>
                    <span className="flex items-center gap-2">
                      {item.is_shared && <Link2 className="size-3.5" aria-label="Shared" />}
                      {item.identified && <span className="font-mono">{percent(item.confidence)}</span>}
                    </span>
                  </div>
                  {item.is_harmful && (
                    <div className="mt-2">
                      <RiskBadge level={item.risk_level || "High"}>Harmful bloom species</RiskBadge>
                    </div>
                  )}
                </div>
              </Link>
              <button
                type="button"
                onClick={() => remove(item.id)}
                aria-label="Delete identification"
                className="absolute top-2 right-2 grid size-9 place-items-center rounded-lg bg-ink/70 text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {loading && <div className="flex justify-center py-8 text-muted"><Spinner /></div>}
      {!loading && items.length < total && (
        <div className="mt-6 flex justify-center">
          <Button variant="secondary" onClick={() => load(items.length)}>Load more</Button>
        </div>
      )}
    </div>
  );
}

function Contributions() {
  const [data, setData] = useState<{ items: Submission[]; counts: Record<string, number> } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ items: Submission[]; counts: Record<string, number> }>("/api/submissions/mine")
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Couldn't load your contributions."));
  }, []);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!data) return <PageLoading />;

  const counts = data.counts;
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        {[
          ["In review", counts.pending],
          ["Needs revision", counts.needs_revision],
          ["Approved", counts.approved],
          ["Not accepted", counts.rejected],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-surface p-4">
            <dt className="label">{label}</dt>
            <dd className="mt-1 font-mono text-2xl">{value ?? 0}</dd>
          </div>
        ))}
      </dl>

      {data.items.length === 0 ? (
        <EmptyState
          icon={<Send className="size-8" aria-hidden />}
          title="No contributions yet"
          action={<ButtonLink href="/contribute">Submit an observation</ButtonLink>}
        >
          Approved observations become part of the open species library, credited to you.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {data.items.map((s) => (
            <li key={s.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
              <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-ink-raised">
                {s.image_url && <img src={s.image_url} alt="" className="size-full object-cover" loading="lazy" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <SpeciesName name={scientificName(s.proposed_genus, s.proposed_species || "")} className="text-xl" />
                  <StatusBadge status={s.status} />
                </div>
                <p className="mt-1 text-sm text-muted">
                  Submitted {formatDate(s.created_at)}
                  {s.location_found ? ` · ${s.location_found}` : ""}
                </p>
                {s.admin_notes && (
                  <div className={`mt-3 rounded-lg p-3 text-sm ${s.status === "needs_revision" ? "bg-risk-medium-tint" : "bg-paper"}`}>
                    <span className="label">Reviewer</span>
                    <p className="mt-1">{s.admin_notes}</p>
                  </div>
                )}
              </div>
              {(s.status === "needs_revision" || s.status === "pending") && (
                <ButtonLink href={`/contribute?edit=${s.id}`} variant={s.status === "needs_revision" ? "primary" : "secondary"} size="sm">
                  <Pencil className="size-4" aria-hidden /> {s.status === "needs_revision" ? "Revise" : "Edit"}
                </ButtonLink>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Profile() {
  const { user, me, updateProfile } = useAuth();
  const [name, setName] = useState(me?.display_name || user?.user_metadata?.display_name || "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await updateProfile(name.trim());
    setBusy(false);
    setMessage(error ? { tone: "error", text: error } : { tone: "success", text: "Saved. Your name appears on approved contributions." });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Panel>
        <form onSubmit={save} className="space-y-4">
          <Field label="Display name" htmlFor="display-name" hint="Shown as the contributor on approved observations.">
            <Input id="display-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </Field>
          <Field label="Email" htmlFor="email">
            <Input id="email" value={user?.email || ""} disabled />
          </Field>
          {message && <Notice tone={message.tone}>{message.text}</Notice>}
          <Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</Button>
        </form>
      </Panel>
      <Panel>
        <h2 className="label mb-4">Activity</h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-muted">Identifications</dt>
            <dd className="font-mono text-2xl">{me?.stats.identifications ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Harmful species</dt>
            <dd className="font-mono text-2xl text-risk-high">{me?.stats.harmful ?? "—"}</dd>
          </div>
        </dl>
        {me?.is_admin && (
          <p className="mt-5 border-t border-line pt-4 text-sm text-muted">
            You are a reviewer. <Link href="/admin" className="text-brand hover:underline">Open the review queue</Link>
          </p>
        )}
      </Panel>
    </div>
  );
}

function WorkspaceContent() {
  const { user, loading, me, requestSignIn } = useAuth();
  const params = useSearchParams();
  const router = useRouter();
  const initial = (params.get("tab") as TabId) || "identifications";
  const [tab, setTab] = useState<TabId>(["identifications", "contributions", "profile"].includes(initial) ? initial : "identifications");

  if (loading) return <PageLoading />;
  if (!user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <EmptyState
          title="Sign in to see your workspace"
          action={<Button onClick={() => requestSignIn("Sign in to see your saved identifications and contributions.")}>Sign in</Button>}
        >
          Your identifications are saved automatically once you&apos;re signed in, and you can follow your contributions
          through review.
        </EmptyState>
      </div>
    );
  }

  return (
    <>
      <section className="on-ink bg-ink text-ink-text">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4 px-4 pt-10 pb-8 sm:px-8">
          <div>
            <p className="label">My workspace</p>
            <h1 className="mt-2 font-serif text-5xl text-white">{me?.display_name || user.email?.split("@")[0]}</h1>
          </div>
          <ButtonLink href="/" variant="signal">
            <Plus className="size-4" aria-hidden /> New identification
          </ButtonLink>
        </div>
      </section>
      <div className="border-b border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <Tabs<TabId>
            label="Workspace sections"
            active={tab}
            onChange={(id) => {
              setTab(id);
              router.replace(`/workspace?tab=${id}`, { scroll: false });
            }}
            items={[
              { id: "identifications", label: "Identifications" },
              { id: "contributions", label: "Contributions" },
              { id: "profile", label: "Profile" },
            ]}
          />
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-8" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "identifications" && <Identifications />}
        {tab === "contributions" && <Contributions />}
        {tab === "profile" && <Profile key={me?.display_name ?? "loading"} />}
      </div>
    </>
  );
}

export default function WorkspacePage() {
  return (
    <Suspense fallback={<PageLoading />}>
      <WorkspaceContent />
    </Suspense>
  );
}
