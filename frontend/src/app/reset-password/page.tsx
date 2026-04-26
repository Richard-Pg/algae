"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuth } from "@/contexts/AuthContext";

export default function ResetPasswordPage() {
  const { updatePassword, user } = useAuth();
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  // Wait for the auth session to be established from the recovery link
  useEffect(() => {
    // Give Supabase a moment to process the recovery token from the URL hash
    const timer = setTimeout(() => setReady(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newPassword || !confirmPassword) {
      setError("Please fill in both fields.");
      return;
    }

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const { error } = await updatePassword(newPassword);
    if (error) {
      setError(error);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  if (!ready) {
    return (
      <>
        <Header />
        <main className="main-content">
          <div className="reset-password-container">
            <div className="glass-card reset-card">
              <div className="dna-spinner" style={{ margin: "2rem auto" }} />
              <p style={{ textAlign: "center", color: "var(--text-muted)" }}>
                Verifying your reset link...
              </p>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Header />
        <main className="main-content">
          <div className="reset-password-container">
            <div className="glass-card reset-card">
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "3rem", marginBottom: "var(--space-md)" }}>⚠️</div>
                <h2>Invalid or Expired Link</h2>
                <p style={{ color: "var(--text-secondary)", margin: "var(--space-md) 0 var(--space-xl)" }}>
                  This password reset link is invalid or has expired. Please request a new one.
                </p>
                <button
                  className="upload-btn upload-btn-primary"
                  onClick={() => router.push("/")}
                >
                  Back to Home
                </button>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  if (success) {
    return (
      <>
        <Header />
        <main className="main-content">
          <div className="reset-password-container">
            <div className="glass-card reset-card">
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "3rem", marginBottom: "var(--space-md)" }}>✅</div>
                <h2>Password Updated!</h2>
                <p style={{ color: "var(--text-secondary)", margin: "var(--space-md) 0 var(--space-xl)" }}>
                  Your password has been successfully updated. You can now use your new password to sign in.
                </p>
                <button
                  className="upload-btn upload-btn-primary"
                  onClick={() => router.push("/")}
                >
                  Go to Home
                </button>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="main-content">
        <div className="reset-password-container">
          <div className="glass-card reset-card">
            <h2 style={{ textAlign: "center", marginBottom: "var(--space-xs)" }}>
              🔒 Set New Password
            </h2>
            <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.88rem", marginBottom: "var(--space-xl)" }}>
              Enter your new password below.
            </p>

            {error && (
              <div className="auth-error" style={{ marginBottom: "var(--space-md)" }}>
                ❌ {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-field">
                <label htmlFor="new-password">New Password</label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>

              <div className="auth-field">
                <label htmlFor="confirm-new-password">Confirm New Password</label>
                <input
                  id="confirm-new-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                className="upload-btn upload-btn-primary auth-submit"
                disabled={loading}
              >
                {loading ? "Updating..." : "Update Password"}
              </button>
            </form>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
