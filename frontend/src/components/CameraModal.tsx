"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Notice } from "@/components/ui/Primitives";

/**
 * Live camera capture for desktop webcams and USB microscope cameras.
 * On phones the native camera is used instead (see ImagePicker).
 */
export default function CameraModal({
  open,
  onClose,
  onCapture,
}: {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setReady(false);
  }, []);

  const start = useCallback(
    async (id?: string) => {
      stop();
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: id
            ? { deviceId: { exact: id }, width: { ideal: 1920 }, height: { ideal: 1080 } }
            : { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
          setReady(true);
        }
        const all = await navigator.mediaDevices.enumerateDevices();
        setDevices(all.filter((d) => d.kind === "videoinput"));
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";
        setError(
          name === "NotAllowedError"
            ? "Camera access was blocked. Allow it in your browser's site settings and try again."
            : name === "NotFoundError"
              ? "No camera was found. Connect a webcam or microscope camera, or upload a photo instead."
              : "The camera couldn't be started. Try again or upload a photo instead.",
        );
      }
    },
    [stop],
  );

  useEffect(() => {
    if (open) start(deviceId || undefined);
    else stop();
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" }));
        onClose();
      },
      "image/jpeg",
      0.92,
    );
  };

  return (
    <Dialog open={open} onClose={onClose} title="Take a photo" wide>
      <div className="relative aspect-video overflow-hidden rounded-xl bg-ink">
        <video ref={videoRef} playsInline muted className="size-full object-contain" />
        {!ready && !error && (
          <div className="absolute inset-0 grid place-items-center text-sm text-ink-soft">Starting camera…</div>
        )}
      </div>
      {error && (
        <Notice tone="warning" className="mt-4">
          {error}
        </Notice>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        {devices.length > 1 ? (
          <label className="flex items-center gap-2 text-sm text-muted">
            Camera
            <select
              className="rounded-lg border border-line-strong bg-surface px-2 py-1.5 text-sm text-text"
              value={deviceId}
              onChange={(e) => {
                setDeviceId(e.target.value);
                start(e.target.value || undefined);
              }}
            >
              <option value="">Default</option>
              {devices.map((d, i) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label || `Camera ${i + 1}`}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          {error && (
            <Button variant="secondary" onClick={() => start(deviceId || undefined)}>
              <RotateCcw className="size-4" aria-hidden /> Retry
            </Button>
          )}
          <Button onClick={capture} disabled={!ready}>
            <Camera className="size-4" aria-hidden /> Capture
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
