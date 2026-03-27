"use client";

interface ConfidenceGaugeProps {
    confidence: number; // 0-1
    size?: number;
}

export default function ConfidenceGauge({ confidence, size = 100 }: ConfidenceGaugeProps) {
    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - confidence * circumference;
    const percentage = Math.round(confidence * 100);

    return (
        <div className="confidence-circle" style={{ width: size, height: size }}>
            <svg viewBox="0 0 100 100">
                <defs>
                    <linearGradient id="confidence-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#1B6B93" />
                        <stop offset="50%" stopColor="#2B7AB2" />
                        <stop offset="100%" stopColor="#2E8B57" />
                    </linearGradient>
                </defs>
                <circle className="bg-ring" cx="50" cy="50" r={radius} />
                <circle
                    className="progress-ring"
                    cx="50"
                    cy="50"
                    r={radius}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    style={{ transition: "stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)" }}
                />
            </svg>
            <div className="confidence-value">
                {percentage}%
                <span>confidence</span>
            </div>
        </div>
    );
}
