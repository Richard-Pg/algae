"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

const DynamicGBIFMap = dynamic(() => import("./GBIFMap"), {
  ssr: false,
  loading: () => (
    <div style={{ height: "300px", display: "flex", justifyContent: "center", alignItems: "center", background: "rgba(0,0,0,0.2)", borderRadius: "var(--radius-md)", border: "1px solid rgba(255,255,255,0.1)" }}>
      <div className="dna-spinner" style={{ transform: "scale(0.5)" }}></div>
    </div>
  ),
});

interface GBIFData {
  occurrences: number;
  images: string[];
  scientificName: string;
  gbifUrl: string;
  taxonKey: number;
}

export default function GBIFDataViewer({ genus, kingdom }: { genus: string, kingdom?: string }) {
  const [data, setData] = useState<GBIFData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!genus || genus === "Unknown") {
      setLoading(false);
      return;
    }

    let isMounted = true;

    const fetchGBIFData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Get the GBIF Taxon Key for the Genus
        // We MUST use verbose=true because ambiguous names (like Microcystis: Bacteria vs Snail)
        // return matchType: NONE and hide the alternatives without it.
        const matchRes = await fetch(`https://api.gbif.org/v1/species/match?name=${encodeURIComponent(genus)}&verbose=true`);
        if (!matchRes.ok) throw new Error("Failed to match species in GBIF");
        const matchData = await matchRes.json();
        console.log("GBIF API Match Data:", matchData);

        let taxonKey = matchData.usageKey;
        let scientificName = matchData.scientificName;

        // If no direct exact match, dive into verbose alternatives
        if (!taxonKey && matchData.alternatives && matchData.alternatives.length > 0) {
          // 1. Prefer an alternative that matches the expected Kingdom (if provided)
          // 2. Otherwise prefer a genus level match
          // 3. Otherwise grab the first alternative
          let bestMatch = matchData.alternatives[0];
          
          if (kingdom) {
             const kingdomMatch = matchData.alternatives.find((alt: any) => 
               alt.kingdom && alt.kingdom.toLowerCase() === kingdom.toLowerCase()
             );
             if (kingdomMatch) bestMatch = kingdomMatch;
          } else {
             const genusMatch = matchData.alternatives.find((alt: any) => alt.rank === "GENUS");
             if (genusMatch) bestMatch = genusMatch;
          }

          taxonKey = bestMatch.genusKey || bestMatch.usageKey;
          scientificName = bestMatch.scientificName;
        }

        if (!taxonKey) {
          if (isMounted) {
            setLoading(false);
            setData(null); 
          }
          return;
        }

        // 2. Concurrently fetch Occurrences Count and Media
        const [occurrenceRes, mediaRes] = await Promise.all([
          fetch(`https://api.gbif.org/v1/occurrence/search?taxonKey=${taxonKey}&limit=0`),
          fetch(`https://api.gbif.org/v1/occurrence/search?taxonKey=${taxonKey}&mediaType=StillImage&limit=20`)
        ]);

        const occurrenceData = await occurrenceRes.json();
        const mediaData = await mediaRes.json();
        console.log("GBIF Occurrence Count Data:", occurrenceData);
        console.log("GBIF Taxon Key passed to Map:", taxonKey);

        // Extract high-quality image URLs
        const imageUrls: string[] = [];
        if (mediaData.results) {
          for (const result of mediaData.results) {
            if (result.media) {
              for (const mediaItem of result.media) {
                if (mediaItem.type === "StillImage" && mediaItem.identifier) {
                  // Some identifiers are just filenames without scheme, ignore those or filter carefully.
                  if (mediaItem.identifier.startsWith('http')) {
                    imageUrls.push(mediaItem.identifier);
                  }
                }
              }
            }
          }
        }

        // De-duplicate and take top 4 images
        const uniqueImages = Array.from(new Set(imageUrls)).slice(0, 4);

        if (isMounted) {
          setData({
            occurrences: occurrenceData.count || 0,
            images: uniqueImages,
            scientificName: scientificName,
            gbifUrl: `https://www.gbif.org/species/${taxonKey}`,
            taxonKey: taxonKey
          });
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          console.error("GBIF Fetch Error:", err);
          setError("Failed to load global data.");
          setLoading(false);
        }
      }
    };

    fetchGBIFData();

    return () => {
      isMounted = false;
    };
  }, [genus]);

  if (loading) {
    return (
      <div className="glass-card full-width mt-lg" style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-xl)' }}>
        <div className="dna-spinner" style={{ transform: 'scale(0.5)' }}></div>
        <span className="text-muted" style={{ marginLeft: 'var(--space-md)', alignSelf: 'center' }}>Connecting to Global Biodiversity Information Facility...</span>
      </div>
    );
  }

  if (error || !data || (data.occurrences === 0 && data.images.length === 0)) {
    return null; // Fail gracefully by hiding the section
  }

  return (
    <div className="glass-card full-width mt-lg fade-in">
      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <span>🌍 Global Biodiversity Info (GBIF)</span>
        <a 
          href={data.gbifUrl} 
          target="_blank" 
          rel="noopener noreferrer"
          className="format-badge"
          style={{ textDecoration: 'none', background: 'var(--accent-color)', color: 'white', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          <span>🔗</span> View GBIF Record
        </a>
      </div>

      <div style={{ marginBottom: "var(--space-lg)" }}>
        <div style={{ 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '8px', 
          background: 'rgba(0,0,0,0.2)', 
          padding: '8px 16px', 
          borderRadius: '20px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <span style={{ fontSize: '1.2rem' }}>📊</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {data.occurrences.toLocaleString()} global observation records
          </span>
          <span className="text-muted" style={{ fontSize: '0.85rem' }}>for <i>{data.scientificName}</i></span>
        </div>
      </div>

      {/* Global Distribution Heatmap */}
      {data.taxonKey && (
        <div style={{ marginBottom: "var(--space-lg)" }}>
          <h4 style={{ color: "var(--text-secondary)", marginBottom: "var(--space-md)", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>🗺️</span> Global Bloom Distribution
          </h4>
          <DynamicGBIFMap taxonKey={data.taxonKey} />
        </div>
      )}

      {/* Verified Field Specimens Gallery */}
      {data.images.length > 0 && (
        <>
          <h4 style={{ color: "var(--text-secondary)", marginBottom: "var(--space-md)", fontSize: "0.9rem", display: "flex", alignItems: "center", gap: "8px" }}>
            <span>🔬</span> Verified Field Specimens
          </h4>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', 
            gap: 'var(--space-md)' 
          }}>
            {data.images.map((url, idx) => (
              <div key={idx} style={{ 
                aspectRatio: '1/1', 
                borderRadius: 'var(--radius-md)', 
                overflow: 'hidden', 
                background: 'rgba(0,0,0,0.3)',
                boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)',
                position: 'relative'
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={url} 
                  alt={`Verified ${genus} specimen from GBIF`}
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.3s ease' }}
                  onError={(e) => {
                    // Hide broken image links gracefully
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                  }}
                />
              </div>
            ))}
          </div>
          <p className="text-muted mt-sm" style={{ fontSize: '0.75rem', textAlign: 'right' }}>
            Images provided by institutions via Global Biodiversity Information Facility.
          </p>
        </>
      )}
    </div>
  );
}
console.log("Checking component structure...")
