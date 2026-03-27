"use client";

interface ToxinBadgeProps {
    riskLevel: string;
    toxinType?: string;
    healthEffects?: string;
    producesToxin: boolean;
    isAiGenerated?: boolean;
}

export default function ToxinBadge({ riskLevel, toxinType, healthEffects, producesToxin, isAiGenerated }: ToxinBadgeProps) {
    const level = riskLevel?.toLowerCase() || "none";
    const icons: Record<string, string> = {
        high: "☠️",
        medium: "⚠️",
        low: "ℹ️",
        none: "✅",
    };

    return (
        <div>
            <div className={`toxin-badge ${level}`}>
                <span>{icons[level] || "❓"}</span>
                <span>Risk: {riskLevel || "Unknown"}</span>
                {isAiGenerated && <span className="ai-badge">💡 AI-Generated Estimation</span>}
            </div>
            <div className="toxin-details">
                <div className="toxin-detail-row">
                    <span className="toxin-label">Produces Toxin</span>
                    <span className="toxin-value">{producesToxin ? "Yes" : "No"}</span>
                </div>
                {toxinType && toxinType !== "None" && (
                    <div className="toxin-detail-row">
                        <span className="toxin-label">Toxin Type</span>
                        <span className="toxin-value">{toxinType}</span>
                    </div>
                )}
                {healthEffects && (
                    <div className="toxin-detail-row">
                        <span className="toxin-label">Health Effects</span>
                        <span className="toxin-value">{healthEffects}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
