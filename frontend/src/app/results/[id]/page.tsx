"use client";

import { use, useEffect, useState } from "react";
import { Lock } from "lucide-react";
import ResultView from "@/components/results/ResultView";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState, PageLoading } from "@/components/ui/Primitives";
import { useAuth } from "@/contexts/AuthContext";
import { api, ApiError } from "@/lib/api";
import { readCachedResult } from "@/lib/resultCache";
import type { Identification } from "@/lib/types";

export default function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: authLoading, requestSignIn } = useAuth();
  const [result, setResult] = useState<Identification | null>(null);
  const [error, setError] = useState<"missing" | "failed" | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const cached = readCachedResult(id);
      if (cached) return setResult(cached);
      if (id === "local") return setError("missing");
      try {
        const fetched = await api<Identification>(`/api/identifications/${encodeURIComponent(id)}`);
        if (!cancelled) {
          setResult(fetched);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError && e.status === 404 ? "missing" : "failed");
      }
    };
    // Wait for the session so the request carries the owner's token.
    if (!authLoading) load();
    return () => {
      cancelled = true;
    };
  }, [id, authLoading, user]);

  if (result) return <ResultView key={result.id ?? "local"} result={result} />;

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20">
        <EmptyState
          icon={<Lock className="size-8" aria-hidden />}
          title={error === "missing" ? "This result isn't available" : "The result couldn't be loaded"}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {error === "missing" && !user && (
                <Button onClick={() => requestSignIn("Sign in to open your saved results.")}>Sign in</Button>
              )}
              <ButtonLink href="/" variant="secondary">
                Identify an image
              </ButtonLink>
            </div>
          }
        >
          {error === "missing"
            ? "It may have been deleted, or it belongs to someone who hasn't shared it."
            : "Check your connection and refresh the page."}
        </EmptyState>
      </div>
    );
  }

  return <PageLoading label="Loading result…" />;
}
