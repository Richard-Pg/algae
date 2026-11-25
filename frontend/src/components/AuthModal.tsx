"use client";

import { useState, type FormEvent } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, Input } from "@/components/ui/Form";
import { Notice } from "@/components/ui/Primitives";

type Mode = "signin" | "signup" | "forgot";

const titles: Record<Mode, string> = {
  signin: "Sign in",
  signup: "Create an account",
  forgot: "Reset your password",
};

/** The one sign-in dialog, opened from anywhere with useAuth().requestSignIn(). */
export default function AuthModal() {
  const { authPrompt, closeSignIn, signIn, signUp, resetPassword } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const switchTo = (next: Mode) => {
    setMode(next);
    setError(null);
    setSuccess(null);
    setPassword("");
    setConfirm("");
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!email) return setError("Enter your email address.");

    if (mode === "forgot") {
      setBusy(true);
      const { error } = await resetPassword(email);
      setBusy(false);
      return error ? setError(error) : setSuccess("Check your inbox (and spam folder) for a reset link.");
    }
    if (password.length < 6) return setError("Passwords need at least 6 characters.");
    if (mode === "signup" && password !== confirm) return setError("The passwords don't match.");

    setBusy(true);
    if (mode === "signup") {
      const { error } = await signUp(email, password);
      if (error) setError(error);
      else {
        switchTo("signin");
        setSuccess("Account created. Confirm your email from the link we sent, then sign in.");
      }
    } else {
      const { error } = await signIn(email, password);
      if (error) setError(error);
      else closeSignIn();
    }
    setBusy(false);
  };

  return (
    <Dialog open={authPrompt.open} onClose={closeSignIn} title={titles[mode]}>
      {authPrompt.message && mode !== "forgot" && <p className="-mt-2 mb-5 text-sm text-muted">{authPrompt.message}</p>}

      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Email" htmlFor="auth-email">
          <Input
            id="auth-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@university.edu"
          />
        </Field>
        {mode !== "forgot" && (
          <Field label="Password" htmlFor="auth-password">
            <Input
              id="auth-password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        )}
        {mode === "signup" && (
          <Field label="Confirm password" htmlFor="auth-confirm">
            <Input
              id="auth-confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </Field>
        )}

        {error && <Notice tone="error">{error}</Notice>}
        {success && <Notice tone="success">{success}</Notice>}

        <Button type="submit" disabled={busy} className="mt-1 w-full">
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
        </Button>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-sm">
        {mode === "signin" && (
          <>
            <button type="button" className="text-brand hover:underline" onClick={() => switchTo("signup")}>
              Create an account
            </button>
            <button type="button" className="text-muted hover:text-text" onClick={() => switchTo("forgot")}>
              Forgot password?
            </button>
          </>
        )}
        {mode !== "signin" && (
          <button type="button" className="text-brand hover:underline" onClick={() => switchTo("signin")}>
            Already have an account? Sign in
          </button>
        )}
      </div>
    </Dialog>
  );
}
