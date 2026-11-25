"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Check, KeyRound, TriangleAlert } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Form";
import { EmptyState, Notice, PageLoading, Panel } from "@/components/ui/Primitives";
import { useAuth } from "@/contexts/AuthContext";

export default function ResetPasswordPage() {
  const { updatePassword, user, loading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [ready, setReady] = useState(false);

  // Supabase needs a moment to exchange the recovery token in the URL.
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1000);
    return () => clearTimeout(t);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) return setError("Passwords need at least 6 characters.");
    if (password !== confirm) return setError("The passwords don't match.");
    setBusy(true);
    const { error } = await updatePassword(password);
    setBusy(false);
    if (error) setError(error);
    else setDone(true);
  };

  if (!ready || loading) return <PageLoading label="Checking your reset link…" />;

  return (
    <div className="mx-auto max-w-md px-4 py-20">
      {!user ? (
        <EmptyState
          icon={<TriangleAlert className="size-8" aria-hidden />}
          title="This link is invalid or has expired"
          action={<ButtonLink href="/">Back to AlgaeAI</ButtonLink>}
        >
          Request a new reset link from the sign-in dialog.
        </EmptyState>
      ) : done ? (
        <EmptyState
          icon={<Check className="size-8 text-brand" aria-hidden />}
          title="Password updated"
          action={<ButtonLink href="/">Continue</ButtonLink>}
        >
          You&apos;re signed in with your new password.
        </EmptyState>
      ) : (
        <Panel className="p-7">
          <KeyRound className="size-7 text-brand" aria-hidden />
          <h1 className="mt-4 text-2xl font-semibold">Choose a new password</h1>
          <p className="mt-1 text-sm text-muted">For {user.email}</p>
          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <Field label="New password" htmlFor="new-password">
              <Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </Field>
            <Field label="Confirm password" htmlFor="confirm-password">
              <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </Field>
            {error && <Notice tone="error">{error}</Notice>}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Saving…" : "Update password"}
            </Button>
          </form>
        </Panel>
      )}
    </div>
  );
}
