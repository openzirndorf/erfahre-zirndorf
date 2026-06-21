import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { ExternalLink, MapPin } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { externalMapUrl } from "../lib/maps";
import type { Place } from "../types";

export interface UserPosition { lat: number; lon: number; accuracy_m?: number }

interface Props {
  place: Place;
  height?: string;
  userPosition?: UserPosition | null;
  isMystery?: boolean;
}

export function ChallengeMap({ place, height = "240px", userPosition, isMystery = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const [mapError, setMapError] = useState(false);

  // Karte einmalig aufbauen
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [place.lon, place.lat],
      zoom: 16,
    });
    mapRef.current = map;
    map.on("error", () => setMapError(true));

    map.on("styleimagemissing", (e: { id: string }) => {
      map.addImage(e.id, { width: 1, height: 1, data: new Uint8ClampedArray(4) });
    });

    if (isMystery) {
      // Mystery: grauer ?-Marker am Dummy-Standort (Bahnhof), kein Radius
      const el = document.createElement("div");
      el.style.cssText = `
        width: 40px; height: 40px;
        background: #6b7280;
        border: 3px solid white;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 18px; font-weight: 900; color: white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      `;
      el.textContent = "?";
      new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([place.lon, place.lat])
        .setPopup(new maplibregl.Popup({ offset: 20 }).setHTML("<strong>Mystery Ort</strong><br/>Finde diesen Ort!"))
        .addTo(map);
    } else {
      // Normaler grüner Pin
      const outer = document.createElement("div");
      outer.style.cssText = "width: 40px; height: 40px;";
      const pin = document.createElement("div");
      pin.style.cssText = `
        width: 40px; height: 40px;
        background: var(--oz-brand-green);
        border: 3px solid white;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        transform-origin: center center;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      `;
      outer.appendChild(pin);
      new maplibregl.Marker({ element: outer, anchor: "bottom" })
        .setLngLat([place.lon, place.lat])
        .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(
          `<strong>${place.title}</strong><br/>Radius: ${place.radius_m} m`,
        ))
        .addTo(map);

      // Radius-Kreis nur bei normalen Challenges
      map.on("load", () => {
        map.addSource("radius", {
          type: "geojson",
          data: createCircle(place.lat, place.lon, place.radius_m),
        });
        map.addLayer({ id: "radius-fill", type: "fill", source: "radius",
          paint: { "fill-color": "#009a00", "fill-opacity": 0.15 } });
        map.addLayer({ id: "radius-outline", type: "line", source: "radius",
          paint: { "line-color": "#009a00", "line-width": 2, "line-dasharray": [2, 2] } });
      });
    }

    return () => { map.remove(); mapRef.current = null; };
  }, [place]);

  if (mapError) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3 bg-white border border-gray-200 text-center px-4"
        style={{ height, borderRadius: "var(--oz-radius-lg)" }}
      >
        <MapPin className="w-8 h-8 text-gray-300" />
        <div>
          <p className="text-sm font-bold text-gray-700">Karte konnte nicht geladen werden</p>
          <p className="text-xs text-gray-500">{place.title}</p>
        </div>
        <a
          href={externalMapUrl(place)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white no-underline"
          style={{ background: "var(--oz-brand-green)" }}
        >
          In Karten-App öffnen
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    );
  }

  // Nutzer-Position dynamisch aktualisieren (ohne Karte neu zu bauen)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Alten Marker entfernen
    userMarkerRef.current?.remove();
    userMarkerRef.current = null;

    if (!userPosition) return;

    // Blauer Puls-Marker für den eigenen Standort
    const dot = document.createElement("div");
    dot.innerHTML = `
      <div style="
        width: 20px; height: 20px;
        background: #3b82f6;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(59,130,246,0.5);
        position: relative;
      ">
        <div style="
          position: absolute;
          inset: -6px;
          border-radius: 50%;
          border: 2px solid rgba(59,130,246,0.4);
          animation: pulse-ring 1.5s ease-out infinite;
        "></div>
      </div>
      <style>
        @keyframes pulse-ring {
          0%   { transform: scale(0.8); opacity: 1; }
          100% { transform: scale(1.8); opacity: 0; }
        }
      </style>
    `;

    userMarkerRef.current = new maplibregl.Marker({ element: dot, anchor: "center" })
      .setLngLat([userPosition.lon, userPosition.lat])
      .setPopup(new maplibregl.Popup({ offset: 16, closeButton: false }).setHTML(
        `<span style="font-size:12px">Dein Standort${userPosition.accuracy_m ? ` (±${Math.round(userPosition.accuracy_m)} m)` : ""}</span>`,
      ))
      .addTo(map);

    // Karte so anpassen, dass beide Punkte sichtbar sind
    const bounds = new maplibregl.LngLatBounds();
    bounds.extend([place.lon, place.lat]);
    bounds.extend([userPosition.lon, userPosition.lat]);
    map.fitBounds(bounds, { padding: 60, maxZoom: 17, duration: 800 });
  }, [userPosition, place]);

  return (
    <div
      ref={containerRef}
      style={{ height, borderRadius: "var(--oz-radius-lg)", overflow: "hidden" }}
    />
  );
}

function createCircle(lat: number, lon: number, radiusM: number, points = 64): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords = [];
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dx = (radiusM * Math.cos(angle)) / (111_320 * Math.cos((lat * Math.PI) / 180));
    const dy = (radiusM * Math.sin(angle)) / 110_540;
    coords.push([lon + dx, lat + dy]);
  }
  coords.push(coords[0]);
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [coords] } };
}
