"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import AuthModal from "@/components/AuthModal";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

interface HistoryItem {
    id: string;
    created_at: string;
    filename: string;
    image_url: string | null;
    result: {
        identified: boolean;
        primary_identification?: {
            genus: string;
            species: string;
            confidence: number;
        };
    };
}

function HistoryContent() {
    const { user, loading: authLoading } = useAuth();
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAuth, setShowAuth] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const filter = searchParams.get("filter");

    useEffect(() => {
        if (authLoading) return;

        if (!user) {
            setLoading(false);
            return;
        }

        const fetchHistory = async () => {
            setLoading(true);
            const { data, error } = await supabase
                .from("identification_history")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false })
                .limit(50);

            if (error) {
                console.error("Failed to fetch history:", error);
            } else {
                let fetchedHistory = data || [];
                
                // Apply filter if present
                if (filter === "harmful") {
                    fetchedHistory = fetchedHistory.filter(item => 
                        item.result?.identified && 
                        item.result?.is_harmful
                    );
                }
                
                setHistory(fetchedHistory);
            }
            setLoading(false);
        };

        fetchHistory();
    }, [user, authLoading, filter]);

    const handleCardClick = (item: HistoryItem) => {
        sessionStorage.setItem("algae_result", JSON.stringify(item.result));
        sessionStorage.setItem("algae_image", item.image_url || "");
        router.push("/results");
    };

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    return (
        <>
            <Header />
            <main className="main-content">
                <div className="results-header">
                    <div>
                        <h1>{filter === "harmful" ? "Harmful Species Found" : "Identification History"}</h1>
                        {user && (
                            <p style={{ color: "var(--text-muted)", marginTop: "var(--space-xs)" }}>
                                {history.length} {filter === "harmful" ? "harmful species detected" : `previous ${history.length === 1 ? "analysis" : "analyses"}`}
                            </p>
                        )}
                    </div>
                    <button className="back-button" onClick={() => router.push("/")}>
                        ← New Analysis
                    </button>
                </div>

                {/* Not logged in state */}
                {!authLoading && !user && (
                    <div className="glass-card" style={{ textAlign: "center", padding: "var(--space-3xl)" }}>
                        <div style={{ fontSize: "3rem", marginBottom: "var(--space-md)", opacity: 0.4 }}>🔒</div>
                        <h3 style={{ marginBottom: "var(--space-sm)" }}>Sign in to view your history</h3>
                        <p style={{ color: "var(--text-muted)", marginBottom: "var(--space-lg)", fontSize: "0.9rem" }}>
                            Create an account to save and access your identification history across devices.
                        </p>
                        <button
                            className="upload-btn upload-btn-primary"
                            onClick={() => setShowAuth(true)}
                        >
                            🔑 Sign In / Create Account
                        </button>
                    </div>
                )}

                {/* Loading state */}
                {(authLoading || (user && loading)) && (
                    <div style={{ textAlign: "center", padding: "var(--space-3xl)" }}>
                        <div className="dna-spinner" style={{ margin: "0 auto" }} />
                        <p style={{ color: "var(--text-muted)", marginTop: "var(--space-md)" }}>Loading history...</p>
                    </div>
                )}

                {/* Empty state */}
                {user && !loading && history.length === 0 && (
                    <div className="glass-card" style={{ textAlign: "center", padding: "var(--space-3xl)" }}>
                        <div style={{ fontSize: "3rem", marginBottom: "var(--space-md)", opacity: 0.4 }}>🔬</div>
                        <h3 style={{ marginBottom: "var(--space-sm)" }}>No identifications yet</h3>
                        <p style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
                            Upload your first algae image to get started.
                        </p>
                    </div>
                )}

                {/* History grid */}
                {user && !loading && history.length > 0 && (
                    <div className="history-grid">
                        {history.map((item) => (
                            <div
                                key={item.id}
                                className="glass-card history-card fade-in"
                                onClick={() => handleCardClick(item)}
                            >
                                <div className="history-card-image">
                                    {item.image_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={item.image_url} alt={item.filename || "Analysis"} />
                                    ) : (
                                        <span style={{ fontSize: "2.5rem", opacity: 0.3 }}>🔬</span>
                                    )}
                                </div>
                                <div className="history-card-species">
                                    {item.result.identified && item.result.primary_identification
                                        ? `${item.result.primary_identification.genus} ${item.result.primary_identification.species}`
                                        : "Unidentified"
                                    }
                                </div>
                                <div className="history-card-meta">
                                    <span>{formatDate(item.created_at)}</span>
                                    {item.result.identified && item.result.primary_identification && (
                                        <span className="history-card-confidence">
                                            {Math.round(item.result.primary_identification.confidence * 100)}%
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
            <AuthModal
                isOpen={showAuth}
                onClose={() => setShowAuth(false)}
                message="Sign in to view and manage your identification history."
            />
        </>
    );
}

export default function HistoryPage() {
    return (
        <Suspense fallback={<div className="main-content"><div className="text-center" style={{ padding: "var(--space-3xl)" }}><div className="dna-spinner" style={{ margin: "0 auto" }} /><p className="text-muted mt-md">Loading...</p></div></div>}>
            <HistoryContent />
        </Suspense>
    );
}
