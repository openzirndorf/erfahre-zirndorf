import "maplibre-gl/dist/maplibre-gl.css";
import maplibregl from "maplibre-gl";
import { AlertTriangle, BookOpen, CheckCircle2, ClipboardList, ExternalLink, LogIn, MapPin, Star, UserPlus, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { fetchChallenges } from "../api/client";
import { CheckInButton } from "../components/checkin-button";
import { SuccessModal } from "../components/success-modal";
import { externalMapUrl } from "../lib/maps";
import { calcMaxPoints, type Challenge, type CheckInResponse } from "../types";

const ZIRNDORF_CENTER: [number, number] = [10.9556, 49.4443];

function isLoggedIn(): boolean {
  try { return !!localStorage.getItem("auth"); } catch { return false; }
}

type MarkerState = "done" | "open" | "mystery" | "mystery-done" | "task" | "task-done";

function markerState(c: Challenge): MarkerState {
  if (c.user_checked_in) {
    if (c.is_mystery) return "mystery-done";
    if (c.is_task) return "task-done";
    return "done";
  }
  if (c.is_mystery) return "mystery";
  if (c.is_task) return "task";
  return "open";
}

const MARKER_STYLE: Record<MarkerState, { bg: string; border: string; text: string; label: string }> = {
  done:           { bg: "#009a00", border: "#007a00", text: "#fff",    label: "✓" },
  open:           { bg: "#fff",    border: "#009a00", text: "#009a00", label: "🚴" },
  mystery:        { bg: "#fff",    border: "#7c3aed", text: "#7c3aed", label: "🧙" },
  "mystery-done": { bg: "#7c3aed", border: "#5b21b6", text: "#fff",    label: "✓" },
  task:           { bg: "#fff",    border: "#dc2626", text: "#dc2626", label: "🚴" },
  "task-done":    { bg: "#dc2626", border: "#991b1b", text: "#fff",    label: "✓" },
};

function ChallengeOverlay({
  challenge,
  onClose,
  onCheckedIn,
}: {
  challenge: Challenge;
  onClose: () => void;
  onCheckedIn: (response: CheckInResponse) => void;
}) {
  const done = challenge.user_checked_in ?? false;

  return (
    <div
      className="absolute bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 z-20"
      style={{ filter: "drop-shadow(0 8px 24px rgba(0,0,0,0.18))" }}
    >
      <div className="bg-white rounded-2xl overflow-hidden">
        <div
          className="h-1.5"
          style={{
            background: done
              ? "var(--oz-brand-green)"
              : "linear-gradient(90deg, var(--oz-brand-green), #7ecf00)",
          }}
        />

        <div className="p-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="flex-1 min-w-0">
              {challenge.day_number && (
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">
                  Tag {challenge.day_number}
                </p>
              )}
              <h3
                className="font-black text-base leading-snug text-gray-900"
                style={{ fontFamily: "var(--oz-font-heading)" }}
              >
                {challenge.title}
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-full text-gray-400 hover:bg-gray-100 shrink-0"
              aria-label="Schließen"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mystery-Warnung */}
          {challenge.is_mystery && !done && (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3 text-xs font-semibold" style={{ background: "#fef3c7", color: "#92400e" }}>
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              Achtung: Dieser Pin zeigt nicht den echten Ort!
            </div>
          )}

          {/* Meta */}
          <div className="flex items-center gap-3 text-xs text-gray-400 mb-3">
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {challenge.is_mystery && !done ? "Mystery Ort – Standort unbekannt" : challenge.place.title}
            </span>
            {!done && (
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                bis {calcMaxPoints(challenge)} Punkte
              </span>
            )}
            {done && (
              <span className="flex items-center gap-1 font-semibold" style={{ color: "var(--oz-brand-green)" }}>
                <CheckCircle2 className="w-3 h-3" />
                Erledigt
              </span>
            )}
          </div>

          {/* Check-in direkt im Overlay */}
          {isLoggedIn() && challenge.quiz_question && !done ? (
            <Link
              to={`/challenge/${challenge.id}`}
              className="flex items-center justify-center gap-2 rounded-2xl px-6 py-4 font-bold text-base text-white no-underline"
              style={{ background: "var(--oz-brand-green)" }}
            >
              <ClipboardList className="w-5 h-5" />
              Quiz beantworten & einchecken
            </Link>
          ) : isLoggedIn() ? (
            <CheckInButton
              key={challenge.id}
              challengeId={challenge.id}
              place={challenge.place}
              alreadyCheckedIn={done}
              onSuccess={onCheckedIn}
            />
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 text-center mb-3">
                Melde dich an, um diese Challenge einzuchecken.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/anmelden"
                  className="flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-bold border-2 no-underline"
                  style={{ borderColor: "var(--oz-brand-green)", color: "var(--oz-brand-green)" }}
                >
                  <LogIn className="w-4 h-4" />
                  Anmelden
                </Link>
                <Link
                  to="/registrieren"
                  className="flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-bold text-white no-underline"
                  style={{ background: "var(--oz-brand-green)" }}
                >
                  <UserPlus className="w-4 h-4" />
                  Registrieren
                </Link>
              </div>
            </div>
          )}

          {/* Link zur Detailseite – prominent */}
          <Link
            to={`/challenge/${challenge.id}`}
            className="mt-3 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold no-underline"
            style={{ background: "var(--oz-brand-green-light)", color: "var(--oz-brand-green)" }}
          >
            <BookOpen className="w-4 h-4" />
            Story & Details
          </Link>
          {!challenge.is_mystery && (
            <a
              href={externalMapUrl(challenge.place)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 no-underline"
            >
              In Karten-App öffnen
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [selected, setSelected] = useState<Challenge | null>(null);
  const [successResponse, setSuccessResponse] = useState<CheckInResponse | null>(null);

  useEffect(() => {
    fetchChallenges().then(setChallenges).catch(console.error);
  }, []);

  function handleCheckedIn(response: CheckInResponse) {
    // Challenge im State als erledigt markieren
    setChallenges((prev) =>
      prev.map((c) => c.id === selected?.id ? { ...c, user_checked_in: true } : c)
    );
    setSelected((prev) => prev ? { ...prev, user_checked_in: true } : null);
    setSuccessResponse(response);
  }

  useEffect(() => {
    if (!mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: ZIRNDORF_CENTER,
      zoom: 13.5,
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
      }),
      "top-right",
    );

    map.on("click", () => setSelected(null));
    map.on("styleimagemissing", (e: { id: string }) => {
      map.addImage(e.id, { width: 1, height: 1, data: new Uint8ClampedArray(4) });
    });

    challenges.forEach((challenge) => {
      const state = markerState(challenge);
      const style = MARKER_STYLE[state];

      const outer = document.createElement("div");
      outer.style.cssText = "width: 36px; height: 36px; cursor: pointer;";

      const el = document.createElement("div");
      el.style.cssText = `
        width: 36px; height: 36px;
        background: ${style.bg};
        border: 3px solid ${style.border};
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 14px; color: ${style.text};
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        transition: transform 0.15s;
        transform-origin: center center;
        font-weight: 700;
      `;
      el.textContent = style.label;
      outer.appendChild(el);

      outer.addEventListener("mouseenter", () => { el.style.transform = "scale(1.2)"; });
      outer.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });
      outer.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelected(challenge);
      });

      new maplibregl.Marker({ element: outer })
        .setLngLat([challenge.place.lon, challenge.place.lat])
        .addTo(map);
    });

    return () => map.remove();
  }, [challenges]);

  return (
    <div className="h-[calc(100vh-64px)] relative">
      <div ref={mapRef} className="w-full h-full" />

      {/* Legende */}
      <div className="absolute top-4 left-4 bg-white rounded-xl px-3 py-2 shadow-lg text-xs space-y-1.5">
        {(["open", "task", "mystery", "done"] as MarkerState[]).map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0"
              style={{
                background: MARKER_STYLE[s].bg,
                border: `2px solid ${MARKER_STYLE[s].border}`,
                color: MARKER_STYLE[s].text,
              }}
            >
              {MARKER_STYLE[s].label}
            </div>
            <span className="text-gray-600">
              {s === "done" ? "Erledigt" : s === "mystery" ? "Mystery Ort" : s === "task" ? "Aufgabe" : "Offen"}
            </span>
          </div>
        ))}
      </div>

      {/* Check-in Overlay */}
      {selected && !successResponse && (
        <ChallengeOverlay
          challenge={selected}
          onClose={() => setSelected(null)}
          onCheckedIn={handleCheckedIn}
        />
      )}

      {/* Erfolgs-Modal */}
      {successResponse && (
        <SuccessModal
          response={successResponse}
          challengeTitle={selected?.title}
          onClose={() => { setSuccessResponse(null); setSelected(null); }}
        />
      )}
    </div>
  );
}
