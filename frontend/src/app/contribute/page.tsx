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
  const { user, session } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [proposedGenus, setProposedGenus] = useState("");
  const [proposedSpecies, setProposedSpecies] = useState("");
  const [locationFound, setLocationFound] = useState("");
  const [userNotes, setUserNotes] = useState("");
  const [submittedMorphology, setSubmittedMorphology] = useState("");
  const [collectionDate, setCollectionDate] = useState("");
  const [sampleType, setSampleType] = useState("");
  const [microscopyMethod, setMicroscopyMethod] = useState("");
  const [contributorConfidence, setContributorConfidence] = useState("");
  const [taxonomy, setTaxonomy] = useState({
    kingdom: "",
    phylum: "",
    class: "",
    order: "",
    family: "",
  });
  const [toxin, setToxin] = useState({
    produces_toxin: "",
    toxin_type: "",
    risk_level: "",
    health_effects: "",
  });
  const [ecology, setEcology] = useState({
    habitat: "",
    water_type: "",
    bloom_conditions: "",
    temperature_range: "",
    indicator_of: "",
  });
  const [referencesText, setReferencesText] = useState("");

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
    if (!session?.access_token) { setError("Your session has expired. Please sign in again."); return; }
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
      formData.append("submitted_morphology", submittedMorphology.trim());
      formData.append("collection_date", collectionDate.trim());
      formData.append("sample_type", sampleType.trim());
      formData.append("microscopy_method", microscopyMethod.trim());
      formData.append("contributor_confidence", contributorConfidence.trim());
      formData.append("submitted_taxonomy", JSON.stringify(taxonomy));
      formData.append("submitted_toxin", JSON.stringify(toxin));
      formData.append("submitted_ecology", JSON.stringify(ecology));
      formData.append("submitted_references", JSON.stringify(
        referencesText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => ({ label: "", url: line, notes: "" }))
      ));

      const res = await fetch(`${API_BASE}/api/submit-species`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: formData,
      });
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
              <button className="btn-secondary" onClick={() => {
                setSuccess(false); setSelectedImage(null); setSelectedFile(null); setProposedGenus(""); setProposedSpecies(""); setLocationFound(""); setUserNotes("");
                setSubmittedMorphology(""); setCollectionDate(""); setSampleType(""); setMicroscopyMethod(""); setContributorConfidence(""); setReferencesText("");
                setTaxonomy({ kingdom: "", phylum: "", class: "", order: "", family: "" });
                setToxin({ produces_toxin: "", toxin_type: "", risk_level: "", health_effects: "" });
                setEcology({ habitat: "", water_type: "", bloom_conditions: "", temperature_range: "", indicator_of: "" });
              }}>
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
            <div className="contribute-fields-row">
              <div className="contribute-field">
                <label htmlFor="collection-date">Collection date (optional)</label>
                <input id="collection-date" type="date" className="contribute-input"
                  value={collectionDate} onChange={(e) => setCollectionDate(e.target.value)} />
              </div>
              <div className="contribute-field">
                <label htmlFor="sample-type">Sample type (optional)</label>
                <input id="sample-type" type="text" className="contribute-input" placeholder="e.g. freshwater bloom, lab culture, marine sample"
                  value={sampleType} onChange={(e) => setSampleType(e.target.value)} />
              </div>
            </div>
            <div className="contribute-field">
              <label htmlFor="location">Where was this found?</label>
              <input id="location" type="text" className="contribute-input" placeholder="e.g. Lake Tahoe, California, USA — freshwater bloom"
                value={locationFound} onChange={(e) => setLocationFound(e.target.value)} />
            </div>
            <div className="contribute-fields-row" style={{ marginTop: "var(--space-md)" }}>
              <div className="contribute-field">
                <label htmlFor="microscopy-method">Microscopy method (optional)</label>
                <input id="microscopy-method" type="text" className="contribute-input" placeholder="e.g. brightfield, 1000x, Lugol preserved"
                  value={microscopyMethod} onChange={(e) => setMicroscopyMethod(e.target.value)} />
              </div>
              <div className="contribute-field">
                <label htmlFor="contributor-confidence">Your confidence (optional)</label>
                <input id="contributor-confidence" type="text" className="contribute-input" placeholder="e.g. high, moderate, uncertain"
                  value={contributorConfidence} onChange={(e) => setContributorConfidence(e.target.value)} />
              </div>
            </div>
            <div className="contribute-field" style={{ marginTop: "var(--space-md)" }}>
              <label htmlFor="notes">Additional notes for our review team</label>
              <textarea id="notes" className="contribute-input contribute-textarea"
                placeholder="Why do you think this is this species? Any special features you noticed? Microscopy technique used?"
                value={userNotes} onChange={(e) => setUserNotes(e.target.value)} rows={4} />
            </div>
          </div>

          <details className="contribute-section" open>
            <summary className="contribute-label" style={{ cursor: "pointer" }}>
              <span className="contribute-label-num">04</span>
              Optional Scientific Evidence
            </summary>

            <div className="contribute-field" style={{ marginTop: "var(--space-md)" }}>
              <label htmlFor="morphology">Morphology notes</label>
              <textarea id="morphology" className="contribute-input contribute-textarea"
                placeholder="Cell shape, size, colony structure, chloroplast position, valve/raphe/striae details..."
                value={submittedMorphology} onChange={(e) => setSubmittedMorphology(e.target.value)} rows={3} />
            </div>

            <div className="admin-detail-label" style={{ marginTop: "var(--space-lg)" }}>Taxonomy</div>
            <div className="contribute-fields-row">
              {(["kingdom", "phylum", "class", "order", "family"] as const).map((key) => (
                <div className="contribute-field" key={key}>
                  <label htmlFor={`taxonomy-${key}`}>{key.charAt(0).toUpperCase() + key.slice(1)}</label>
                  <input id={`taxonomy-${key}`} type="text" className="contribute-input"
                    value={taxonomy[key]} onChange={(e) => setTaxonomy({ ...taxonomy, [key]: e.target.value })} />
                </div>
              ))}
            </div>

            <div className="admin-detail-label" style={{ marginTop: "var(--space-lg)" }}>Toxicity</div>
            <div className="contribute-fields-row">
              <div className="contribute-field">
                <label htmlFor="produces-toxin">Produces toxin?</label>
                <input id="produces-toxin" type="text" className="contribute-input" placeholder="yes/no/unknown"
                  value={toxin.produces_toxin} onChange={(e) => setToxin({ ...toxin, produces_toxin: e.target.value })} />
              </div>
              <div className="contribute-field">
                <label htmlFor="toxin-type">Toxin type</label>
                <input id="toxin-type" type="text" className="contribute-input" placeholder="e.g. microcystin, anatoxin-a"
                  value={toxin.toxin_type} onChange={(e) => setToxin({ ...toxin, toxin_type: e.target.value })} />
              </div>
              <div className="contribute-field">
                <label htmlFor="risk-level">Risk level</label>
                <input id="risk-level" type="text" className="contribute-input" placeholder="None/Low/Medium/High"
                  value={toxin.risk_level} onChange={(e) => setToxin({ ...toxin, risk_level: e.target.value })} />
              </div>
              <div className="contribute-field">
                <label htmlFor="health-effects">Health effects</label>
                <input id="health-effects" type="text" className="contribute-input"
                  value={toxin.health_effects} onChange={(e) => setToxin({ ...toxin, health_effects: e.target.value })} />
              </div>
            </div>

            <div className="admin-detail-label" style={{ marginTop: "var(--space-lg)" }}>Ecology</div>
            <div className="contribute-fields-row">
              {(["habitat", "water_type", "bloom_conditions", "temperature_range", "indicator_of"] as const).map((key) => (
                <div className="contribute-field" key={key}>
                  <label htmlFor={`ecology-${key}`}>{key.replaceAll("_", " ")}</label>
                  <input id={`ecology-${key}`} type="text" className="contribute-input"
                    value={ecology[key]} onChange={(e) => setEcology({ ...ecology, [key]: e.target.value })} />
                </div>
              ))}
            </div>

            <div className="contribute-field" style={{ marginTop: "var(--space-md)" }}>
              <label htmlFor="references">References / evidence links</label>
              <textarea id="references" className="contribute-input contribute-textarea"
                placeholder="One DOI, paper, AlgaeBase, GBIF, WoRMS, NCBI, or other evidence link per line"
                value={referencesText} onChange={(e) => setReferencesText(e.target.value)} rows={4} />
            </div>
          </details>

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
