"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import ConfidenceGauge from "@/components/ConfidenceGauge";
import TaxonomyTree from "@/components/TaxonomyTree";
import ToxinBadge from "@/components/ToxinBadge";
import HABAlert from "@/components/HABAlert";
import GBIFDataViewer from "@/components/GBIFDataViewer";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default function ResultsPage() {
    const [result, setResult] = useState<any>(null);
    const [image, setImage] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        const storedResult = sessionStorage.getItem("algae_result");
        const storedImage = sessionStorage.getItem("algae_image");

        if (!storedResult) {
            router.push("/");
            return;
        }

        setResult(JSON.parse(storedResult));
        setImage(storedImage);
    }, [router]);

    if (!result) {
        return (
            <>
                <Header />
                <main className="main-content">
                    <div className="text-center" style={{ padding: "var(--space-3xl)" }}>
                        <div className="dna-spinner" style={{ margin: "0 auto" }} />
                        <p className="text-muted mt-md">Loading results...</p>
                    </div>
                </main>
            </>
        );
    }

    // Not identified
    if (!result.identified) {
        return (
            <>
                <Header />
                <main className="main-content fade-in">
                    <div className="results-header">
                        <button className="back-button" onClick={() => router.push("/")}>
                            ← New Analysis
                        </button>
                    </div>
                    <div className="glass-card error-card">
                        <div className="error-icon">🔍</div>
                        <div className="error-message">Could Not Identify Algae</div>
                        <div className="error-detail">
                            {result.error_message || "The image could not be analyzed. Please try a clearer image."}
                        </div>
                        {result.suggestions && (
                            <p className="text-muted mt-md" style={{ fontSize: "0.875rem" }}>
                                💡 {result.suggestions}
                            </p>
                        )}
                    </div>
                </main>
            </>
        );
    }

    const primary = result.primary_identification || {};
    const dbInfo = result.database_info || {};
    const taxonomy = dbInfo.taxonomy || {};
    const toxin = dbInfo.toxin || {};
    const ecology = dbInfo.ecology || {};
    const alternatives = result.alternative_identifications || [];
    const trivia = result.trivia || {};

    return (
        <>
            <Header />
            <main className="main-content fade-in">
                <div className="results-header">
                    <button className="back-button" onClick={() => router.push("/")}>
                        ← New Analysis
                    </button>
                    <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
                        <span className="format-badge" style={{ fontSize: "0.75rem" }}>
                            {result.image_type || "unknown"}
                        </span>
                        <span className="format-badge" style={{ fontSize: "0.75rem" }}>
                            Quality: {result.image_quality || "unknown"}
                        </span>
                    </div>
                </div>

                {/* HAB Alert */}
                {result.is_harmful && result.hab_alert && (
                    <HABAlert
                        message={result.hab_alert}
                        speciesName={primary.species || primary.genus}
                    />
                )}

                <div className="results-grid" style={{ marginTop: result.is_harmful ? "var(--space-lg)" : 0 }}>
                    {/* Species Identification Card */}
                    <div className="glass-card glass-card-accent species-card">
                        <div className="section-title">Primary Identification</div>
                        <div className="species-main">
                            {image && (
                                <div className="species-image">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={image} alt="Uploaded algae image" />
                                </div>
                            )}
                            <div className="species-info">
                                <div className="species-name">
                                    {primary.species || primary.genus || "Unknown"}
                                </div>
                                <div className="species-common">
                                    Genus: {primary.genus || "Unknown"}
                                </div>

                                {/* Confidence Gauge */}
                                <div className="confidence-container">
                                    <ConfidenceGauge confidence={primary.confidence || 0} size={100} />
                                    <div>
                                        <div style={{ fontSize: "0.875rem", color: "var(--text-secondary)", marginBottom: "var(--space-xs)" }}>
                                            AI Confidence Score
                                        </div>
                                        {primary.morphological_notes && (
                                            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.6 }}>
                                                {primary.morphological_notes}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Description */}
                                {dbInfo.description && (
                                    <p className="species-description mt-md">{dbInfo.description}</p>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="results-columns">
                        {/* Left Column */}
                        <div className="results-column">
                            {/* Alternative Species */}
                            {alternatives.length > 0 && (
                                <div className="glass-card">
                                    <div className="section-title">Other Possible Species</div>
                                    <div className="alternatives-list">
                                        {alternatives.map((alt: any, i: number) => (
                                            <div key={i} className="alt-species">
                                                <span className="alt-species-name">
                                                    {alt.species || alt.genus || "Unknown"}
                                                </span>
                                                <span className="alt-species-confidence">
                                                    {Math.round((alt.confidence || 0) * 100)}%
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Toxin Information */}
                            {Object.keys(toxin).length > 0 && (
                                <div className="glass-card">
                                    <div className="section-title">Toxin Information</div>
                                    <ToxinBadge
                                        riskLevel={toxin.risk_level || "Unknown"}
                                        toxinType={toxin.toxin_type}
                                        healthEffects={toxin.health_effects}
                                        producesToxin={toxin.produces_toxin || false}
                                        isAiGenerated={toxin.is_ai_generated}
                                    />
                                </div>
                            )}

                            {/* Morphology */}
                            {dbInfo.morphology && (
                                <div className="glass-card">
                                    <div className="section-title">Morphology</div>
                                    <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.7 }}>
                                        {dbInfo.morphology}
                                    </p>
                                </div>
                            )}

                            {/* Analysis Notes */}
                            {result.analysis_notes && (
                                <div className="glass-card">
                                    <div className="section-title">AI Analysis Notes</div>
                                    <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.7 }}>
                                        {result.analysis_notes}
                                    </p>
                                </div>
                            )}

                            {/* Discovery & Lore ✨ */}
                            {Object.keys(trivia).length > 0 && (
                                <div className="glass-card">
                                    <div className="section-title">Discovery & Lore ✨</div>
                                    <div className="trivia-grid" style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}>
                                        {trivia.discovery_history && (
                                            <div>
                                                <h4 style={{ color: "var(--text-secondary)", marginBottom: "var(--space-xs)", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <span>📖</span> Discovery History
                                                </h4>
                                                <p style={{ fontSize: "0.875rem", lineHeight: 1.7 }}>{trivia.discovery_history}</p>
                                            </div>
                                        )}
                                        {trivia.fun_fact && (
                                            <div>
                                                <h4 style={{ color: "var(--text-secondary)", marginBottom: "var(--space-xs)", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <span>💡</span> Fun Fact
                                                </h4>
                                                <p style={{ fontSize: "0.875rem", lineHeight: 1.7 }}>{trivia.fun_fact}</p>
                                            </div>
                                        )}
                                        {trivia.references && trivia.references.length > 0 && (
                                            <div>
                                                <h4 style={{ color: "var(--text-secondary)", marginBottom: "var(--space-xs)", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <span>📚</span> Scientific References
                                                </h4>
                                                <ul style={{ fontSize: "0.85rem", paddingLeft: "var(--space-lg)", color: "var(--text-muted)", lineHeight: 1.6, margin: 0 }}>
                                                    {trivia.references.map((ref: string, i: number) => (
                                                        <li key={i}>{ref}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Right Column */}
                        <div className="results-column">
                            {/* Taxonomy */}
                            {Object.keys(taxonomy).length > 0 && (
                                <div className="glass-card">
                                    <div className="section-title">Taxonomy Classification</div>
                                    <TaxonomyTree taxonomy={taxonomy} />
                                </div>
                            )}

                            {/* Ecological Information */}
                            {Object.keys(ecology).length > 0 && (
                                <div className="glass-card">
                                    <div className="section-title">
                                        Ecological Information
                                        {ecology.is_ai_generated && <span className="ai-badge">💡 AI-Generated Estimation</span>}
                                    </div>
                                    <div className="ecology-grid">
                                        {ecology.temperature_range && (
                                            <div className="ecology-item">
                                                <div className="ecology-item-icon">🌡️</div>
                                                <div className="ecology-item-label">Temperature Range</div>
                                                <div className="ecology-item-value">{ecology.temperature_range}</div>
                                            </div>
                                        )}
                                        {ecology.water_type && (
                                            <div className="ecology-item">
                                                <div className="ecology-item-icon">💧</div>
                                                <div className="ecology-item-label">Water Type</div>
                                                <div className="ecology-item-value">{ecology.water_type}</div>
                                            </div>
                                        )}
                                        {ecology.habitat && (
                                            <div className="ecology-item">
                                                <div className="ecology-item-icon">🏞️</div>
                                                <div className="ecology-item-label">Habitat</div>
                                                <div className="ecology-item-value">{ecology.habitat}</div>
                                            </div>
                                        )}
                                        {ecology.seasonal_pattern && (
                                            <div className="ecology-item">
                                                <div className="ecology-item-icon">📅</div>
                                                <div className="ecology-item-label">Seasonal Pattern</div>
                                                <div className="ecology-item-value">{ecology.seasonal_pattern}</div>
                                            </div>
                                        )}
                                        {ecology.nutrient_preference && (
                                            <div className="ecology-item">
                                                <div className="ecology-item-icon">🧪</div>
                                                <div className="ecology-item-label">Nutrient Preference</div>
                                                <div className="ecology-item-value">{ecology.nutrient_preference}</div>
                                            </div>
                                        )}
                                        {ecology.indicator_of && (
                                            <div className="ecology-item">
                                                <div className="ecology-item-icon">📊</div>
                                                <div className="ecology-item-label">Indicator Of</div>
                                                <div className="ecology-item-value">{ecology.indicator_of}</div>
                                            </div>
                                        )}
                                    </div>
                                    {ecology.bloom_conditions && (
                                        <div className="glass-card mt-md" style={{ padding: "var(--space-md)", background: "var(--bg-glass)" }}>
                                            <div className="ecology-item-label">Bloom Conditions</div>
                                            <div className="ecology-item-value mt-sm">{ecology.bloom_conditions}</div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom Full-Width Section */}
                <div style={{ marginTop: "1rem" }}>
                    {/* GBIF Data Viewer */}
                    {primary?.genus && primary.genus !== "Unknown" && (
                        <GBIFDataViewer genus={primary.genus} kingdom={primary.kingdom} />
                    )}
                </div>
            </main>
        </>
    );
}
