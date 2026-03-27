"use client";

interface HABAlertProps {
    message: string;
    speciesName?: string;
}

export default function HABAlert({ message, speciesName }: HABAlertProps) {
    return (
        <div className="hab-alert">
            <div className="hab-alert-icon">🚨</div>
            <div>
                <div className="hab-alert-title">
                    ⚠️ Harmful Algal Bloom (HAB) Alert
                </div>
                <div className="hab-alert-text">
                    {speciesName && (
                        <strong style={{ fontStyle: "italic" }}>{speciesName}</strong>
                    )}{" "}
                    {message}
                </div>
            </div>
        </div>
    );
}
