"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { HiddenGem } from "@/lib/types";

// Saffron-toned pin matching the Jasmine palette.
const customIcon = L.divIcon({
  className: "hs-marker",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  html: `<div style="
    width: 32px; height: 32px;
    background: linear-gradient(135deg, #b45309 0%, #d97706 100%);
    border: 2.5px solid #ffffff;
    border-radius: 50%;
    box-shadow:
      0 0 0 4px rgba(180, 83, 9, 0.18),
      0 6px 16px -4px rgba(127, 29, 29, 0.35);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-family: ui-monospace, SFMono-Regular, monospace;
    font-size: 13px;
    font-weight: 600;
  ">●</div>`,
});

function FitBounds({ gems }: { gems: HiddenGem[] }) {
  const map = useMap();
  useEffect(() => {
    if (gems.length === 0) return;
    if (gems.length === 1) {
      map.setView([gems[0].lat, gems[0].lng], 9);
      return;
    }
    const bounds = L.latLngBounds(gems.map((g) => [g.lat, g.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [gems, map]);
  return null;
}

export default function ItineraryMap({ gems }: { gems: HiddenGem[] }) {
  const center: [number, number] = useMemo(() => {
    if (gems.length === 0) return [13.7563, 100.5018]; // Bangkok fallback
    const lat = gems.reduce((s, g) => s + g.lat, 0) / gems.length;
    const lng = gems.reduce((s, g) => s + g.lng, 0) / gems.length;
    return [lat, lng];
  }, [gems]);

  return (
    <MapContainer
      center={center}
      zoom={6}
      scrollWheelZoom={true}
      className="h-full w-full"
      style={{ minHeight: 320 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &middot; tiles by <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />
      {gems.map((g) => (
        <Marker key={g.id} position={[g.lat, g.lng]} icon={customIcon}>
          <Popup>
            <div className="flex flex-col gap-1">
              <strong>{g.name_en}</strong>
              <span style={{ fontSize: 11, opacity: 0.7 }}>{g.province}</span>
              <p style={{ fontSize: 12, margin: "4px 0 0", maxWidth: 240 }}>
                {g.en_description.slice(0, 140)}…
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
      <FitBounds gems={gems} />
    </MapContainer>
  );
}
