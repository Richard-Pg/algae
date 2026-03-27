"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

interface HistoryItem {
  id: string;
  created_at: string;
  filename: string;
  image_url: string | null;
  result: any;
}

export default function DashboardPage() {
  const { user, loading: authLoading, updateProfile } = useAuth();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [stats, setStats] = useState({ total: 0, harmful: 0 });
  const [loading, setLoading] = useState(true);
  
  // Profile editing state
  const [displayName, setDisplayName] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const router = useRouter();

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/");
      return;
    }

    // Set initial display name
    setDisplayName(user.user_metadata?.display_name || "");

    const fetchDashboardData = async () => {
      setLoading(true);
      
      // Fetch recent history (top 4 only to avoid fetching megabytes of old base64 strings)
      const { data, error } = await supabase
        .from("identification_history")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(4);

      if (error) {
        console.error("Failed to fetch dashboard data:", error);
      } else if (data) {
        setHistory(data);
        
        // Fetch exact total count without downloading payloads
        const { count: totalCount } = await supabase
          .from("identification_history")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);
          
        // Fetch exact harmful count without downloading payloads
        const { count: harmfulCount } = await supabase
          .from("identification_history")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("result->>is_harmful", "true");
        
        setStats({ 
          total: totalCount || 0, 
          harmful: harmfulCount || 0 
        });
      }
      setLoading(false);
    };

    fetchDashboardData();
  }, [user, authLoading, router]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (displayName.trim() === user?.user_metadata?.display_name) {
      setIsEditingProfile(false);
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    const { error } = await updateProfile(displayName.trim());
    
    if (error) {
      setSaveMessage({ type: 'error', text: error });
    } else {
      setSaveMessage({ type: 'success', text: "Profile updated successfully." });
      setIsEditingProfile(false);
      
      // Clear message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
    }
    
    setIsSaving(false);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getInitials = () => {
    const name = displayName || user?.email || "?";
    return name.charAt(0).toUpperCase();
  };

  if (authLoading || (loading && user)) {
    return (
      <>
        <Header />
        <main className="main-content" style={{ display: "flex", justifyContent: "center", paddingTop: "100px" }}>
          <div className="dna-spinner" />
        </main>
      </>
    );
  }

  if (!user) return null; // handled by useEffect redirect

  return (
    <>
      <Header />
      <main className="main-content">
        <div className="results-header" style={{ marginBottom: "var(--space-md)" }}>
          <div>
            <h1>Personal Dashboard</h1>
            <p style={{ color: "var(--text-muted)", marginTop: "var(--space-xs)" }}>
              Welcome back, {user.user_metadata?.display_name || user.email?.split('@')[0]}
            </p>
          </div>
        </div>

        {saveMessage && (
          <div className={`fade-in ${saveMessage.type === 'success' ? 'auth-success' : 'auth-error'} mb-md`}>
            {saveMessage.type === 'success' ? '✓ ' : '✕ '} {saveMessage.text}
          </div>
        )}

        <div className="dashboard-grid">
          {/* Left Column: Profile & Settings */}
          <div className="dashboard-section">
            <div className="glass-card">
              <h3 style={{ borderBottom: "1px solid var(--border-subtle)", paddingBottom: "var(--space-sm)" }}>
                User Profile
              </h3>
              
              <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", marginTop: "var(--space-lg)" }}>
                <div style={{
                  width: "64px", height: "64px", borderRadius: "50%", 
                  background: "var(--accent-primary)", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "2rem", fontFamily: "var(--font-serif)"
                }}>
                  {getInitials()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "1.1rem" }}>{user.user_metadata?.display_name || "New User"}</div>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{user.email}</div>
                </div>
              </div>

              <form className="profile-form" onSubmit={handleSaveProfile}>
                <div className="profile-field">
                  <label>Display Name</label>
                  <input 
                    type="text" 
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={!isEditingProfile || isSaving}
                    placeholder="Enter your name"
                  />
                </div>
                
                <div className="profile-field">
                  <label>Email Address</label>
                  <input type="email" value={user.email || ""} disabled />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-sm)", marginTop: "var(--space-sm)" }}>
                  {isEditingProfile ? (
                    <>
                      <button 
                        type="button" 
                        className="upload-btn upload-btn-secondary" 
                        onClick={() => {
                          setDisplayName(user.user_metadata?.display_name || "");
                          setIsEditingProfile(false);
                        }}
                        disabled={isSaving}
                        style={{ padding: "8px 16px", fontSize: "0.85rem" }}
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        className="upload-btn upload-btn-primary"
                        disabled={isSaving}
                        style={{ padding: "8px 16px", fontSize: "0.85rem" }}
                      >
                        {isSaving ? "Saving..." : "Save Changes"}
                      </button>
                    </>
                  ) : (
                    <button 
                      type="button" 
                      className="upload-btn upload-btn-secondary" 
                      onClick={() => setIsEditingProfile(true)}
                      style={{ padding: "8px 16px", fontSize: "0.85rem" }}
                    >
                      ✏️ Edit Profile
                    </button>
                  )}
                </div>
              </form>
            </div>
            
            {/* Stats Card */}
            <div className="glass-card dashboard-stat-card fade-in" style={{ animationDelay: "0.1s" }}>
              <div>
                <div className="dashboard-stat-label">Total Analyses Run</div>
                <div className="dashboard-stat-value">{stats.total}</div>
              </div>
              <div className="dashboard-stat-icon">🔬</div>
            </div>
            
            <div 
              className="glass-card dashboard-stat-card fade-in" 
              style={{ animationDelay: "0.2s", cursor: "pointer" }}
              onClick={() => router.push("/history?filter=harmful")}
            >
              <div>
                <div className="dashboard-stat-label">Harmful Species Detected</div>
                <div className="dashboard-stat-value" style={{ color: "var(--accent-danger)" }}>{stats.harmful}</div>
              </div>
              <div className="dashboard-stat-icon">⚠️</div>
            </div>
          </div>

          {/* Right Column: Recent Activity */}
          <div className="dashboard-section">
            <div className="glass-card" style={{ height: "100%", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-subtle)", paddingBottom: "var(--space-sm)" }}>
                <h3>Recent Activity</h3>
                {history.length > 0 && (
                  <button onClick={() => router.push("/history")} className="link-btn" style={{ fontSize: "0.85rem" }}>
                    View All →
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", opacity: 0.6, padding: "var(--space-2xl) 0" }}>
                  <span style={{ fontSize: "3rem", marginBottom: "var(--space-sm)" }}>📭</span>
                  <p>No identifications run yet.</p>
                  <button onClick={() => router.push("/")} className="link-btn mt-md">Start your first analysis</button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)", marginTop: "var(--space-lg)" }}>
                  {history.map(item => {
                    const isHarmful = item.result?.primary_identification?.is_harmful;
                    return (
                      <div key={item.id} className="glass-card fade-in" style={{ padding: "var(--space-md)", display: "flex", alignItems: "center", gap: "var(--space-md)", cursor: "pointer" }}
                           onClick={() => {
                             sessionStorage.setItem("algae_result", JSON.stringify(item.result));
                             sessionStorage.setItem("algae_image", item.image_url || "");
                             router.push("/results");
                           }}>
                        <div style={{ width: "60px", height: "60px", borderRadius: "var(--radius-sm)", backgroundColor: "var(--bg-secondary)", overflow: "hidden", flexShrink: 0 }}>
                          {item.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.image_url} alt="Thumbnail" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          ) : (
                            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", opacity: 0.3 }}>🔬</div>
                          )}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: "8px" }}>
                            {item.result?.identified && item.result?.primary_identification 
                              ? `${item.result.primary_identification.genus} ${item.result.primary_identification.species}`
                              : "Unidentified"
                            }
                            {isHarmful && <span style={{ fontSize: "0.8rem", background: "rgba(196, 22, 28, 0.1)", color: "var(--accent-danger)", padding: "2px 6px", borderRadius: "4px" }}>Harmful</span>}
                          </div>
                          <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "4px" }}>
                            Analyzed on {formatDate(item.created_at)}
                          </div>
                        </div>
                        <div style={{ color: "var(--brand-primary)", opacity: 0.5 }}>→</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
