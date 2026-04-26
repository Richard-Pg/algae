"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "haiming.peng@outlook.com";

interface Submission {
  id: string;
  user_email: string;
  user_name: string;
  proposed_genus: string;
  proposed_species: string;
  location_found: string;
  user_notes: string;
  image_url: string | null;
  ai_analysis: Record<string, unknown> | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

interface NotificationSettings {
  enabled: boolean;
  configured: boolean;
  recipient: string;
}

export default function AdminPage() {
  const { user, session, loading } = useAuth();
  const router = useRouter();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [actionNotes, setActionNotes] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const isAdmin = user?.email?.trim().toLowerCase() === ADMIN_EMAIL.trim().toLowerCase();

  const fetchSubmissions = async () => {
    if (!isAdmin) return;
    if (!session?.access_token) {
      setFetchError("Waiting for your admin session...");
      return;
    }
    setFetchError(null);
    try {
      const res = await fetch(`${API_BASE}/api/admin/submissions?status=${statusFilter}`, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Backend returned ${res.status}`);
      }
      const data = await res.json();
      setSubmissions(data.submissions);
    } catch (err) {
      setFetchError(err instanceof Error ? `Failed to load submissions: ${err.message}` : "Failed to load submissions.");
    }
  };

  const fetchNotificationSettings = async () => {
    if (!isAdmin || !session?.access_token) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/notification-settings`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to fetch notification settings");
      setNotificationSettings(await res.json());
    } catch {
      setNotificationSettings(null);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchSubmissions();
      fetchNotificationSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, statusFilter, session?.access_token]);

  const handleToggleNotifications = async () => {
    if (!session?.access_token || !notificationSettings) return;
    setSettingsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/notification-settings`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ enabled: !notificationSettings.enabled }),
      });
      if (!res.ok) throw new Error("Failed to save notification settings");
      setNotificationSettings(await res.json());
    } catch {
      alert("Failed to update email notification settings.");
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleAction = async (id: string, action: "approve" | "reject") => {
    if (!session?.access_token) {
      alert("Your session has expired. Please sign in again.");
      return;
    }
    setProcessing(id);
    try {
      const res = await fetch(`${API_BASE}/api/admin/submissions/${id}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          admin_notes: actionNotes[id] || "",
        }),
      });
      if (!res.ok) throw new Error("Action failed");
      await fetchSubmissions();
      setExpanded(null);
    } catch {
      alert("Action failed. Please try again.");
    } finally {
      setProcessing(null);
    }
  };

  if (loading) return <><Header /><main className="main-content"><div className="text-center" style={{ padding: "4rem" }}>Loading...</div></main></>;

  if (!user || !isAdmin) {
    return (
      <>
        <Header />
        <main className="main-content">
          <div className="contribute-hero">
            <div style={{ fontSize: "3rem" }}>🔒</div>
            <h1>Admin Access Only</h1>
            <p>This page is restricted to the AlgaeAI administrator.</p>
            <button className="btn-primary" onClick={() => router.push("/")}>Go Home</button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="main-content">
        <section style={{ marginBottom: "var(--space-xl)" }}>
          <div className="hero-badge"><span className="pulse-dot" />Admin Dashboard</div>
          <h1 style={{ fontFamily: "var(--font-serif)", fontSize: "2rem", marginTop: "var(--space-sm)" }}>
            Species Submission Review
          </h1>
          <p style={{ color: "var(--text-secondary)", marginTop: "var(--space-sm)" }}>
            Review, approve, or reject community-submitted species discoveries.
          </p>
        </section>

        {notificationSettings && (
          <section className="glass-card" style={{ marginBottom: "var(--space-xl)", padding: "var(--space-lg)", display: "flex", justifyContent: "space-between", gap: "var(--space-md)", alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "1.25rem", marginBottom: "var(--space-xs)" }}>
                Email Notifications
              </h2>
              <p style={{ color: "var(--text-secondary)", margin: 0 }}>
                New contribution alerts are sent to {notificationSettings.recipient}.
                {!notificationSettings.configured && " SMTP is not configured yet."}
              </p>
            </div>
            <button
              type="button"
              className={notificationSettings.enabled ? "btn-primary" : "btn-secondary"}
              disabled={settingsSaving}
              onClick={handleToggleNotifications}
            >
              {settingsSaving ? "Saving..." : notificationSettings.enabled ? "Email Alerts On" : "Email Alerts Off"}
            </button>
          </section>
        )}

        {/* Filter Tabs */}
        <div className="admin-tabs">
          {["pending", "approved", "rejected"].map((s) => (
            <button key={s} className={`admin-tab ${statusFilter === s ? "active" : ""}`} onClick={() => setStatusFilter(s)}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        {fetchError && <div className="glass-card error-card mt-lg">{fetchError}</div>}

        {submissions.length === 0 && !fetchError && (
          <div className="glass-card" style={{ textAlign: "center", padding: "var(--space-3xl)", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "2rem", marginBottom: "var(--space-md)" }}>📭</div>
            <p>No {statusFilter} submissions.</p>
          </div>
        )}

        {/* Submission Cards */}
        <div className="admin-submissions-list">
          {submissions.map((sub) => (
            <div key={sub.id} className="admin-submission-card glass-card">
              {/* Summary Row */}
              <div className="admin-submission-summary" onClick={() => setExpanded(expanded === sub.id ? null : sub.id)}>
                {sub.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sub.image_url} alt="Specimen" className="admin-submission-thumb" />
                )}
                <div className="admin-submission-info">
                  <div className="admin-submission-genus">
                    <em>{sub.proposed_genus}</em>
                    {sub.proposed_species && <span> {sub.proposed_species}</span>}
                  </div>
                  <div className="admin-submission-meta">
                    By {sub.user_name || sub.user_email} · {new Date(sub.created_at).toLocaleDateString()}
                    {sub.location_found && <> · 📍 {sub.location_found}</>}
                  </div>
                </div>
                <div className={`admin-status-badge admin-status-${sub.status}`}>
                  {sub.status}
                </div>
                <span className="admin-expand-arrow">{expanded === sub.id ? "▲" : "▼"}</span>
              </div>

              {/* Expanded Details */}
              {expanded === sub.id && (
                <div className="admin-submission-detail fade-in">
                  <div className="admin-detail-grid">
                    {/* Image large */}
                    {sub.image_url && (
                      <div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={sub.image_url} alt="Specimen full" style={{ width: "100%", borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)" }} />
                      </div>
                    )}
                    <div>
                      {sub.user_notes && (
                        <div className="admin-detail-section">
                          <div className="admin-detail-label">Contributor Notes</div>
                          <p>{sub.user_notes}</p>
                        </div>
                      )}
                      {sub.ai_analysis && (
                        <div className="admin-detail-section">
                          <div className="admin-detail-label">AI Analysis</div>
                          <div className="admin-ai-summary">
                            <div><strong>Identified as:</strong> {(sub.ai_analysis as Record<string, {genus?: string}>).primary_identification?.genus ?? "—"}</div>
                            <div><strong>Confidence:</strong> {(sub.ai_analysis as Record<string, {confidence?: number}>).primary_identification?.confidence ?? "—"}%</div>
                            <div><strong>Description:</strong> {(sub.ai_analysis as Record<string, string>).description ?? "—"}</div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {sub.status === "pending" && (
                    <div className="admin-action-row">
                      <textarea
                        placeholder="Optional notes to the contributor..."
                        className="contribute-input contribute-textarea"
                        style={{ marginBottom: "var(--space-md)" }}
                        rows={2}
                        value={actionNotes[sub.id] || ""}
                        onChange={(e) => setActionNotes({ ...actionNotes, [sub.id]: e.target.value })}
                      />
                      <div style={{ display: "flex", gap: "var(--space-md)" }}>
                        <button
                          className="btn-primary"
                          style={{ background: "var(--accent-secondary)" }}
                          disabled={processing === sub.id}
                          onClick={() => handleAction(sub.id, "approve")}
                        >
                          {processing === sub.id ? "Processing..." : "✓ Approve & Add to Database"}
                        </button>
                        <button
                          className="btn-secondary"
                          style={{ color: "var(--accent-danger)", borderColor: "var(--accent-danger)" }}
                          disabled={processing === sub.id}
                          onClick={() => handleAction(sub.id, "reject")}
                        >
                          ✕ Reject
                        </button>
                      </div>
                    </div>
                  )}

                  {sub.admin_notes && (
                    <div className="admin-detail-section" style={{ marginTop: "var(--space-md)", borderTop: "1px solid var(--border-subtle)", paddingTop: "var(--space-md)" }}>
                      <div className="admin-detail-label">Admin Notes</div>
                      <p>{sub.admin_notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
