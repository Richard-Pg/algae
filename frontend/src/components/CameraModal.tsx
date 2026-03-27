"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface CameraModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCapture: (file: File) => void;
}

export default function CameraModal({ isOpen, onClose, onCapture }: CameraModalProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [hasCamera, setHasCamera] = useState(true);
    const [isReady, setIsReady] = useState(false);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const startCamera = useCallback(async () => {
        try {
            setError(null);
            setIsReady(false);
            setCapturedImage(null);

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "environment",
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                },
            });

            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current?.play();
                    setIsReady(true);
                };
            }
        } catch (err) {
            console.error("Camera access failed:", err);
            if (err instanceof DOMException && err.name === "NotAllowedError") {
                setError("Camera permission denied. Please allow camera access in your browser settings.");
            } else if (err instanceof DOMException && err.name === "NotFoundError") {
                setHasCamera(false);
                setError("No camera detected on this device.");
            } else {
                setError("Failed to access camera. Please try again.");
            }
        }
    }, []);

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        setIsReady(false);
    }, []);

    useEffect(() => {
        if (isOpen) {
            startCamera();
        } else {
            stopCamera();
            setCapturedImage(null);
        }
        return () => stopCamera();
    }, [isOpen, startCamera, stopCamera]);

    const handleCapture = () => {
        if (!videoRef.current || !canvasRef.current) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.drawImage(video, 0, 0);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
        setCapturedImage(dataUrl);
        stopCamera();
    };

    const handleRetake = () => {
        setCapturedImage(null);
        startCamera();
    };

    const handleUse = () => {
        if (!capturedImage || !canvasRef.current) return;

        canvasRef.current.toBlob(
            (blob) => {
                if (blob) {
                    const file = new File([blob], `capture_${Date.now()}.jpg`, { type: "image/jpeg" });
                    onCapture(file);
                    onClose();
                }
            },
            "image/jpeg",
            0.92
        );
    };

    if (!isOpen) return null;

    return (
        <div className="camera-modal-overlay" onClick={onClose}>
            <div className="camera-modal" onClick={(e) => e.stopPropagation()}>
                <div className="camera-modal-header">
                    <h3>📷 Camera Capture</h3>
                    <button className="camera-close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="camera-viewport">
                    {error ? (
                        <div className="camera-error">
                            <div style={{ fontSize: "2.5rem", marginBottom: "var(--space-md)" }}>📷</div>
                            <p style={{ fontWeight: 600, marginBottom: "var(--space-sm)" }}>{error}</p>
                            {!hasCamera && (
                                <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                                    Use the &quot;Upload Image&quot; button instead to select a file.
                                </p>
                            )}
                        </div>
                    ) : capturedImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={capturedImage} alt="Captured" className="camera-preview-img" />
                    ) : (
                        <>
                            <video
                                ref={videoRef}
                                autoPlay
                                playsInline
                                muted
                                className="camera-video"
                            />
                            {!isReady && (
                                <div className="camera-loading">
                                    <div className="dna-spinner" />
                                    <p>Starting camera...</p>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <canvas ref={canvasRef} style={{ display: "none" }} />

                <div className="camera-actions">
                    {!error && !capturedImage && (
                        <button
                            className="upload-btn upload-btn-primary camera-shutter"
                            onClick={handleCapture}
                            disabled={!isReady}
                        >
                            ⏺ Capture
                        </button>
                    )}
                    {capturedImage && (
                        <>
                            <button className="upload-btn upload-btn-secondary" onClick={handleRetake}>
                                ↻ Retake
                            </button>
                            <button className="upload-btn upload-btn-primary" onClick={handleUse}>
                                ✓ Use This Photo
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
