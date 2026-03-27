"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet's default icon path issues in Next.js
import L from "leaflet";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface GBIFMapProps {
  taxonKey: number;
}

// Sub-component to track map events
function ZoomTracker({ setZoom }: { setZoom: (z: number) => void }) {
  useMapEvents({
    zoomend: (e) => {
      setZoom(e.target.getZoom());
    },
  });
  return null;
}

export default function GBIFMap({ taxonKey }: GBIFMapProps) {
  const [zoom, setZoom] = useState(2);

  useEffect(() => {
    // Leaflet requires window
    if (typeof window === "undefined") return;
  }, []);

  // Adaptive parameters: As we zoom in, we make the squares larger 
  // to counteract the "density dilution" where points feel like they disappear.
  const squareSize = zoom < 4 ? 16 : zoom < 7 ? 32 : zoom < 10 ? 64 : 128;
  const style = zoom < 8 ? "gladiola.disp" : "purpleHeat.point";

  return (
    <div style={{ height: "300px", width: "100%", borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", zIndex: 0, position: "relative", display: "block" }}>
      <MapContainer 
        center={[20, 0]} 
        zoom={2} 
        scrollWheelZoom={false} 
        style={{ height: "300px", width: "100%", display: "block" }}
        minZoom={1}
      >
        <ZoomTracker setZoom={setZoom} />

        {/* Base Map: CartoDB Dark Matter (Dark monochrome) - provides maximum "neon" pop for vibrant heatmap colors */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          opacity={1.0}
        />
        
        {/* GBIF Occurrence Density Layer - adaptively sized squares to keep visibility high during zoom-in */}
        <TileLayer
          key={`${zoom}-${taxonKey}`} // Force reload on zoom Change to apply new squareSize
          attribution='&copy; <a href="https://www.gbif.org/citation-guidelines">GBIF</a>'
          url={`https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@1x.png?style=${style}&bin=square&squareSize=${squareSize}&taxonKey=${taxonKey}`}
          opacity={0.8}
        />
      </MapContainer>
    </div>
  );
}
