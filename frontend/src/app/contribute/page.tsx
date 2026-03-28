"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 1200;
        let { width, height } = img;
        if (width > height ? width > MAX : height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d")?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob) resolve(new File([blob], file.name.replace(/\.[^/.]+$/, ".webp"), { type: "image/webp" }));
          else resolve(file);
        }, "image/webp", 0.8);
      };
    };
  });
};

export default function ContributePage() {
  const { user } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [proposedGenus, setProposedGenus] = useState("");
  const [proposedSpecies, setProposedSpecies] = useState("");
  const [locationFound, setLocationFound] = useState("");
  const [userNotes, setUserNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(async (file: File) => {
    const compressed = await compressImage(file);
    setSelectedFile(compressed);
    const reader = new FileReader();
    reader.onload = (e) => setSelectedImage(e.target?.result as string);
    reader.readAsDataURL(compressed);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { setError("You must be signed in to contribute."); return; }
    if (!selectedFile) { setError("Please upload an image."); return; }
    if (!proposedGenus.trim()) { setError("Please enter the genus name."); return; }

    setIsSubmitting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("proposed_genus", proposedGenus.trim());
      formData.append("proposed_species", proposedSpecies.trim());
      formData.append("location_found", locationFound.trim());
      formData.append("user_notes", userNotes.trim());
      formData.append("user_id", user.id);
      formData.append("user_email", user.email || "");
      formData.append("user_name", user.user_metadata?.display_name || user.email || "");

      const res = await fetch(`${API_BASE}/api/submit-species`, { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Submission failed");
      }
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) {
    return (
      <>
        <Header />
        <main className="main-content">
          <div className="contribute-hero">
            <div className="contribute-lock-icon">🔒</div>
            <h1>Sign In to Contribute</h1>
            <p>You need an account to submit species discoveries to the community database.</p>
            <button className="btn-primary" onClick={() => router.push("/")}>Go to Homepage</button>
          </div>
        </main>
      </>
    );
  }

  if (success) {
    return (
      <>
        <Header />
        <main className="main-content">
          <div className="contribute-hero">
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🎉</div>
            <h1>Submission Received!</h1>
            <p>Thank you for contributing to the AlgaeAI community database. Your submission is now under review and will be evaluated by our team. This usually takes 1-3 days.</p>
            <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap", marginTop: "1.5rem" }}>
              <button className="btn-primary" onClick={() => router.push("/")}>Back to Identify</button>
              <button className="btn-secondary" onClick={() => { setSuccess(false); setSelectedImage(null); setSelectedFile(null); setProposedGenus(""); setProposedSpecies(""); setLocationFound(""); setUserNotes(""); }}>
                Submit Another
              </button>
            </div>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="main-content">
        {/* Hero */}
        <section className="contribute-hero">
          <div className="hero-badge"><span className="pulse-dot" />Community Science</div>
          <h1>Contribute a Discovery</h1>
          <p>Found a rare or interesting algae species? Share it with the community. After admin review, your discovery may be added to the global AlgaeAI database.</p>
        </section>

        {/* Form */}
        <form className="contribute-form glass-card" onSubmit={handleSubmit}>

          {/* Image Upload */}
          <div className="contribute-section">
            <label className="contribute-label">
              <span className="contribute-label-num">01</span>
              Specimen Image <span className="required-star">*</span>
            </label>
            <div
              className={`contribute-upload-zone ${selectedImage ? "has-image" : ""}`}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => !selectedImage && fileInputRef.current?.click()}
            >
              {selectedImage ? (
                <div className="contribute-image-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedImage} alt="Submitted specimen" />
                  <button type="button" className="contribute-remove-img" onClick={(e) => { e.stopPropagation(); setSelectedImage(null); setSelectedFile(null); }}>✕ Remove</button>
                </div>
              ) : (
                <div className="contribute-upload-placeholder">
                  <div style={{ fontSize: "2rem" }}>🔬</div>
                  <p><strong>Drop image here</strong> or click to browse</p>
                  <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>JPG, PNG, HEIC, WebP  ·  Max 20MB</p>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>

          {/* Species Info */}
          <div className="contribute-section">
            <label className="contribute-label">
              <span className="contribute-label-num">02</span>
              Species Identification
            </label>
            <div className="contribute-fields-row">
              <div className="contribute-field">
                <label htmlFor="genus">Genus <span className="required-star">*</span></label>
                <input id="genus" type="text" className="contribute-input" placeholder="e.g. Microcystis"
                  value={proposedGenus} onChange={(e) => setProposedGenus(e.target.value)} />
              </div>
              <div className="contribute-field">
                <label htmlFor="species">Species (optional)</label>
                <input id="species" type="text" className="contribute-input" placeholder="e.g. aeruginosa"
                  value={proposedSpecies} onChange={(e) => setProposedSpecies(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Context */}
          <div className="contribute-section">
            <label className="contribute-label">
              <span className="contribute-label-num">03</span>
              Context & Notes
            </label>
            <div className="contribute-field">
              <label htmlFor="location">Where was this found?</label>
              <input id="location" type="text" className="contribute-input" placeholder="e.g. Lake Tahoe, California, USA — freshwater bloom"
                value={locationFound} onChange={(e) => setLocationFound(e.target.value)} />
            </div>
            <div className="contribute-field" style={{ marginTop: "var(--space-md)" }}>
              <label htmlFor="notes">Additional notes for our review team</label>
              <textarea id="notes" className="contribute-input contribute-textarea"
                placeholder="Why do you think this is this species? Any special features you noticed? Microscopy technique used?"
                value={userNotes} onChange={(e) => setUserNotes(e.target.value)} rows={4} />
            </div>
          </div>

          {error && (
            <div className="glass-card error-card">
              <div className="error-icon">❌</div>
              <div className="error-message">{error}</div>
            </div>
          )}

          <div className="contribute-submit-row">
            <p className="contribute-fine-print">
              Your submission will be reviewed by our team before being added to the database.
              You&apos;ll be credited as the contributor on the species page.
            </p>
            <button type="submit" className="btn-primary contribute-submit-btn" disabled={isSubmitting}>
              {isSubmitting ? (
                <><div className="dna-spinner" style={{ width: 16, height: 16, margin: 0 }} /> Submitting...</>
              ) : "🌿 Submit Discovery"}
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
