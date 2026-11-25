"use client";

import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

/** OpenStreetMap base (no API key) with GBIF occurrence density on top. */
export default function DistributionMap({ taxonKey, height = 320 }: { taxonKey: number; height?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line" style={{ height }}>
      <MapContainer center={[25, 10]} zoom={1} minZoom={1} scrollWheelZoom={false} worldCopyJump style={{ height: "100%", width: "100%" }}>
        <TileLayer
          className="basemap-muted"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <TileLayer
          attribution='Occurrences &copy; <a href="https://www.gbif.org/citation-guidelines">GBIF</a>'
          url={`https://api.gbif.org/v2/map/occurrence/density/{z}/{x}/{y}@1x.png?srs=EPSG:3857&bin=hex&hexPerTile=40&style=classic-noborder.poly&taxonKey=${taxonKey}`}
          opacity={0.85}
        />
      </MapContainer>
    </div>
  );
}
