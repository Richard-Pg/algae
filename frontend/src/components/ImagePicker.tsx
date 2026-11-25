"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { Camera, ImagePlus } from "lucide-react";
import CameraModal from "@/components/CameraModal";
import { buttonClass } from "@/components/ui/Button";
import { ACCEPTED_TYPES, prepareImage, validateImage, type PreparedImage } from "@/lib/image";

/**
 * Drop zone + file chooser + camera. Also accepts a pasted image (Ctrl/Cmd+V)
 * while it is on screen. On touch devices "Take photo" opens the native camera.
 */
export default function ImagePicker({
  onSelect,
  onError,
  tone = "ink",
  compact = false,
}: {
  onSelect: (image: PreparedImage, original: File) => void;
  onError: (message: string) => void;
  tone?: "ink" | "light";
  compact?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handle = async (file: File | undefined) => {
    if (!file) return;
    const problem = validateImage(file);
    if (problem) return onError(problem);
    setBusy(true);
    try {
      onSelect(await prepareImage(file), file);
    } finally {
      setBusy(false);
    }
  };

  // Paste an image from the clipboard.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith("image/"));
      const file = item?.getAsFile();
      if (file) {
        e.preventDefault();
        handle(new File([file], `pasted-${Date.now()}.${file.type.split("/")[1] || "png"}`, { type: file.type }));
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const takePhoto = () => {
    const touch = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
    if (touch) captureRef.current?.click();
    else setCameraOpen(true);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handle(e.dataTransfer.files[0]);
  };

  const ink = tone === "ink";
  const zone = ink
    ? `border-ink-line bg-ink-raised ${dragging ? "border-signal bg-[#1b2c24]" : "hover:border-ink-muted"}`
    : `border-line-strong bg-surface ${dragging ? "border-brand bg-brand-tint" : "hover:border-muted"}`;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`flex flex-col items-center justify-center rounded-xl border border-dashed text-center transition-colors ${zone} ${
        compact ? "gap-3 px-5 py-8" : "gap-4 px-6 py-12 sm:py-16"
      }`}
    >
      <ImagePlus aria-hidden className={`size-9 ${ink ? "text-signal" : "text-brand"}`} strokeWidth={1.5} />
      <div>
        <p className={`text-base font-medium ${ink ? "text-white" : "text-text"}`}>
          {busy ? "Preparing image…" : "Drop an image here, or paste it"}
        </p>
        <p className={`mt-1 text-sm ${ink ? "text-ink-muted" : "text-muted"}`}>
          JPG, PNG, HEIC, TIFF or WebP · up to 20 MB
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} className={buttonClass(ink ? "signal" : "primary")}>
          <ImagePlus className="size-4" aria-hidden /> Choose image
        </button>
        <button type="button" disabled={busy} onClick={takePhoto} className={buttonClass(ink ? "ghost-ink" : "secondary")}>
          <Camera className="size-4" aria-hidden /> Take photo
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          handle(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={captureRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          handle(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <CameraModal open={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={(f) => handle(f)} />
    </div>
  );
}
