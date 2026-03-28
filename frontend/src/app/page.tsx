"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import CameraModal from "@/components/CameraModal";
import AuthModal from "@/components/AuthModal";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabaseClient";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const FREE_USAGE_LIMIT = 2;

function getAnonymousUsage(): number {
  if (typeof window === "undefined") return 0;
  return parseInt(localStorage.getItem("algaeai_usage_count") || "0", 10);
}

function incrementAnonymousUsage(): number {
  const count = getAnonymousUsage() + 1;
  localStorage.setItem("algaeai_usage_count", String(count));
  return count;
}

// Utility function to compress images using HTML5 Canvas
const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 1200; // Cap width/height for ML analysis while preserving detail
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height = Math.round((height *= MAX_WIDTH / width));
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width = Math.round((width *= MAX_HEIGHT / height));
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Output as highly optimized WebP format
        canvas.toBlob(
          (blob) => {
            if (blob) {
              // Convert JS blob back to a File
              const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, ".webp"), {
                type: "image/webp",
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file); // Fallback to original if compression inexplicably fails
            }
          },
          "image/webp",
          0.8 // 80% quality compression
        );
      };
      img.onerror = (e) => reject(e);
    };
    reader.onerror = (e) => reject(e);
  });
};

export default function HomePage() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMessage, setAuthMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const { user } = useAuth();

  // Close auth modal when user logs in
  useEffect(() => {
    if (user) setShowAuth(false);
  }, [user]);

  const handleFile = useCallback(async (file: File) => {
    setError(null);
    const validTypes = ["image/jpeg", "image/png", "image/heic", "image/heif", "image/tiff", "image/webp"];
    const ext = file.name.split(".").pop()?.toLowerCase();
    const validExts = ["jpg", "jpeg", "png", "heic", "heif", "tiff", "tif", "webp"];

    if (!validTypes.includes(file.type) && !validExts.includes(ext || "")) {
      setError("Unsupported format. Please use JPG, PNG, HEIC, or TIFF.");
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError("File too large. Maximum size is 20MB.");
      return;
    }

    try {
      // Compress the file before sending to Gemini or storing in Supabase Storage
      const compressedFile = await compressImage(file);
      setSelectedFile(compressedFile);
      
      const reader = new FileReader();
      reader.onload = (e) => setSelectedImage(e.target?.result as string);
      reader.readAsDataURL(compressedFile);
    } catch (err) {
      console.error("Compression failed:", err);
      // Fallback to original
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => setSelectedImage(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => setIsDragOver(false), []);

  const handleUploadClick = () => fileInputRef.current?.click();
  const handleCameraClick = () => setIsCameraOpen(true);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    // Check rate limit for anonymous users
    if (!user) {
      const usage = getAnonymousUsage();
      if (usage >= FREE_USAGE_LIMIT) {
        setAuthMessage(
          `You've used your ${FREE_USAGE_LIMIT} free identifications. Create an account to continue with unlimited access and save your history.`
        );
        setShowAuth(true);
        return;
      }
    }

    setIsAnalyzing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(`${API_BASE}/api/identify`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error: ${response.status}`);
      }

      const result = await response.json();

      // Track anonymous usage
      if (!user) {
        incrementAnonymousUsage();
      }

      // Set default image url (Base64 for anonymous users)
      let finalImageUrl = selectedImage;

      // Save to Supabase Storage and DB if logged in
      if (user) {
        try {
          const fileExt = selectedFile.name.split('.').pop();
          const fileName = `${user.id}-${Date.now()}.${fileExt}`;
          
          // 1. Upload file to Supabase Storage Bucket to prevent massive Base64 strings in DB text column
          const { error: uploadError } = await supabase.storage
            .from('algae_images')
            .upload(fileName, selectedFile);
            
          if (uploadError) {
            console.error("Failed to upload image to storage:", uploadError);
          } else {
            // Get the static public URL
            const { data } = supabase.storage.from('algae_images').getPublicUrl(fileName);
            finalImageUrl = data.publicUrl;
          }

          // 2. Save result and tiny URL pointer to History table
          await supabase.from("identification_history").insert({
            user_id: user.id,
            filename: selectedFile.name,
            image_url: finalImageUrl,
            result: result,
          });
        } catch (dbErr) {
          console.error("Failed to save to history:", dbErr);
        }
      }

      // Store result and image in sessionStorage for the results page. Base64 triggers UI freeze, but URL won't.
      sessionStorage.setItem("algae_result", JSON.stringify(result));
      sessionStorage.setItem("algae_image", finalImageUrl || "");

      router.push("/results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze image. Is the backend running?");
      setIsAnalyzing(false);
    }
  };

  const handleClear = () => {
    setSelectedImage(null);
    setSelectedFile(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <>
      <Header />
      <main className="main-content">
        {/* Hero Section */}
        <section className="hero">
          <div className="hero-badge">
            <span className="pulse-dot" />
            AI-Powered Algae Identification
          </div>
          <h1>Identify Algae & Diatoms<br />in Seconds</h1>
          <p>
            Upload a microscope image or bloom photo to instantly classify algae species,
            get confidence scores, and receive ecological & toxin risk information.
          </p>
        </section>

        {/* Upload Zone */}
        <div
          className={`upload-zone ${isDragOver ? "drag-over" : ""}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={!selectedImage ? handleUploadClick : undefined}
          id="upload-zone"
        >
          {!selectedImage ? (
            <>
              <div className="upload-icon">🔬</div>
              <h3>Drop your image here</h3>
              <p>or click to browse files</p>
              <div className="upload-actions">
                <button
                  className="upload-btn upload-btn-primary"
                  onClick={(e) => { e.stopPropagation(); handleUploadClick(); }}
                  id="upload-file-btn"
                >
                  📁 Upload Image
                </button>
                <button
                  className="upload-btn upload-btn-secondary"
                  onClick={(e) => { e.stopPropagation(); handleCameraClick(); }}
                  id="camera-btn"
                >
                  📷 Take Photo
                </button>
              </div>
              <div className="format-badges">
                <span className="format-badge">JPG</span>
                <span className="format-badge">PNG</span>
                <span className="format-badge">HEIC</span>
                <span className="format-badge">TIFF</span>
                <span className="format-badge">WebP</span>
              </div>
            </>
          ) : (
            <div className="image-preview-container">
              <div className="image-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={selectedImage} alt="Selected image for analysis" />
                {isAnalyzing && (
                  <div className="analyzing-overlay">
                    <div className="dna-spinner" />
                    <div className="analyzing-text">Analyzing algae species...</div>
                  </div>
                )}
              </div>
              {!isAnalyzing && (
                <div className="upload-actions" style={{ marginTop: "24px" }}>
                  <button
                    className="upload-btn upload-btn-primary"
                    onClick={(e) => { e.stopPropagation(); handleAnalyze(); }}
                    id="analyze-btn"
                  >
                    🧬 Analyze Image
                  </button>
                  <button
                    className="upload-btn upload-btn-secondary"
                    onClick={(e) => { e.stopPropagation(); handleClear(); }}
                    id="clear-btn"
                  >
                    ✕ Clear
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="glass-card error-card mt-lg fade-in">
            <div className="error-icon">❌</div>
            <div className="error-message">{error}</div>
            <div className="error-detail">
              Make sure the backend server is running on {API_BASE}
            </div>
          </div>
        )}

        {/* Anonymous usage notice */}
        {!user && (
          <div className="usage-notice mt-lg fade-in">
            <p>
              🔓 {FREE_USAGE_LIMIT - getAnonymousUsage() > 0
                ? `${FREE_USAGE_LIMIT - getAnonymousUsage()} free identification${FREE_USAGE_LIMIT - getAnonymousUsage() === 1 ? "" : "s"} remaining`
                : "Free identifications used"
              } ·{" "}
              <button
                className="link-btn"
                onClick={() => {
                  setAuthMessage("Sign in to get unlimited identifications and save your analysis history.");
                  setShowAuth(true);
                }}
              >
                Sign in for unlimited access
              </button>
            </p>
          </div>
        )}

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/heic,image/heif,image/tiff,image/webp,.jpg,.jpeg,.png,.heic,.heif,.tiff,.tif,.webp"
          onChange={handleFileChange}
          className="sr-only"
          id="file-input"
        />
        <CameraModal
          isOpen={isCameraOpen}
          onClose={() => setIsCameraOpen(false)}
          onCapture={(file) => handleFile(file)}
        />
        <AuthModal
          isOpen={showAuth}
          onClose={() => setShowAuth(false)}
          message={authMessage}
        />

        {/* Features Section */}
        <div className="features-grid">
          {[
            {
              num: "01",
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>
                </svg>
              ),
              accentClass: "feature-accent-blue",
              iconClass: "feature-icon-blue",
              title: "Species Classification",
              desc: "Identify cyanobacteria, diatoms, green algae, and more — with confidence scores and alternative predictions.",
              delay: "0.1s",
            },
            {
              num: "02",
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              ),
              accentClass: "feature-accent-amber",
              iconClass: "feature-icon-amber",
              title: "Toxin Risk Assessment",
              desc: "Automatically flags harmful species with toxin data, risk levels, and health advisories when detected.",
              delay: "0.2s",
            },
            {
              num: "03",
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
                </svg>
              ),
              accentClass: "feature-accent-green",
              iconClass: "feature-icon-green",
              title: "Ecological Context",
              desc: "Understand habitat preferences, bloom conditions, and environmental indicators for each species.",
              delay: "0.3s",
            },
          ].map((f) => (
            <div key={f.num} className={`feature-card-premium fade-in ${f.accentClass}`} style={{ animationDelay: f.delay }}>
              <span className="feature-ghost-num">{f.num}</span>
              <div className={`feature-icon-badge ${f.iconClass}`}>{f.icon}</div>
              <h3 className="feature-title">{f.title}</h3>
              <p className="feature-desc">{f.desc}</p>
              <span className="feature-arrow">→</span>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
