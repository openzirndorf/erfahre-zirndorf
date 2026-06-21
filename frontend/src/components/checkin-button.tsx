import { AlertCircle, CheckCircle2, FlaskConical, Loader2, MapPin, Navigation } from "lucide-react";
import React, { useEffect, useState } from "react";
import { submitCheckIn } from "../api/client";
import type { CheckInResponse, Place } from "../types";
import { useToast } from "./toast-provider";

type Phase = "idle" | "requesting" | "submitting" | "success" | "error";

const IS_DEV = (import.meta as { env?: { DEV?: boolean } }).env?.DEV ?? false;

interface Props {
  challengeId: number;
  place: Place;
  alreadyCheckedIn: boolean;
  onSuccess: (response: CheckInResponse) => void;
  onPositionObtained?: (pos: { lat: number; lon: number; accuracy_m: number }) => void;
  showPrivacyNote?: boolean;
  quizAnswerIndex?: number | null;
}

export function CheckInButton({ challengeId, place, alreadyCheckedIn, onSuccess, onPositionObtained, showPrivacyNote = true, quizAnswerIndex }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string>("");
  const { showToast } = useToast();

  useEffect(() => {
    setPhase("idle");
    setMessage("");
  }, [challengeId, place.id]);

  async function doCheckIn(lat: number, lon: number, accuracy_m: number) {
    setPhase("submitting");
    try {
      const response = await submitCheckIn({
        challenge_id: challengeId,
        position: { lat, lon, accuracy_m },
        client_ts: new Date().toISOString(),
        ...(quizAnswerIndex != null ? { quiz_answer_index: quizAnswerIndex } : {}),
      });
      if (response.success) {
        setPhase("success");
        setMessage(response.message);
        showToast(response.is_flagged ? "Check-in erfolgreich, aber zur Prüfung markiert." : response.message, response.is_flagged ? "info" : "success");
        onSuccess(response);
      } else {
        setPhase("error");
        setMessage(response.message);
        showToast(response.message, response.is_flagged ? "info" : "error");
      }
    } catch (err) {
      setPhase("error");
      setMessage(err instanceof Error ? err.message : "Fehler beim Check-in");
      showToast(err instanceof Error ? err.message : "Fehler beim Check-in", "error");
    }
  }

  async function handleCheckIn() {
    if (alreadyCheckedIn || phase === "requesting" || phase === "submitting" || phase === "success") return;
    if (quizAnswerIndex === null) {
      setMessage("Bitte wähle zuerst eine Antwort aus.");
      setPhase("error");
      return;
    }
    if (!navigator.geolocation) {
      setMessage("Dein Browser unterstützt keine GPS-Ortung.");
      setPhase("error");
      showToast("Dein Browser unterstützt keine GPS-Ortung.", "error");
      return;
    }
    if (!navigator.onLine) {
      setMessage("Du bist offline. Check-ins brauchen Internet.");
      setPhase("error");
      showToast("Du bist offline. Check-ins brauchen Internet.", "error");
      return;
    }

    setPhase("requesting");
    setMessage("");

    const locationAuto = localStorage.getItem("oz_location_auto") === "true";
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onPositionObtained?.({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy_m: pos.coords.accuracy });
        doCheckIn(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      },
      (err) => {
        setPhase("error");
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setMessage("Standortzugriff wurde verweigert. Bitte in den Einstellungen aktivieren.");
            showToast("Standortzugriff wurde verweigert.", "error");
            break;
          case err.POSITION_UNAVAILABLE:
            setMessage("Standort konnte nicht ermittelt werden. Bitte im Freien versuchen.");
            showToast("Standort konnte nicht ermittelt werden.", "error");
            break;
          case err.TIMEOUT:
            setMessage("GPS-Signal zu langsam. Bitte erneut versuchen.");
            showToast("GPS-Signal zu langsam. Bitte erneut versuchen.", "error");
            break;
          default:
            setMessage("Standortfehler. Bitte erneut versuchen.");
            showToast("Standortfehler. Bitte erneut versuchen.", "error");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: locationAuto ? 8_000 : 15_000,
        maximumAge: locationAuto ? 120_000 : 0,
      },
    );
  }

  function handleDevCheckIn() {
    // Simuliert Check-in direkt am Zielort
    doCheckIn(place.lat, place.lon, 5.0);
  }

  if (alreadyCheckedIn) {
    return (
      <div
        className="flex items-center justify-center gap-2 rounded-2xl px-6 py-4 font-bold text-base"
        style={{ background: "var(--oz-brand-green-light)", color: "var(--oz-brand-green)" }}
      >
        <CheckCircle2 className="w-5 h-5" />
        Bereits eingecheckt
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={handleCheckIn}
        disabled={phase === "requesting" || phase === "submitting" || phase === "success"}
        className="flex items-center justify-center gap-2 rounded-2xl px-6 py-4 font-bold text-base text-white transition-all active:scale-[0.97] disabled:opacity-60"
        style={{ background: "var(--oz-brand-green)" }}
      >
        {phase === "requesting" && <><Loader2 className="w-5 h-5 animate-spin" />GPS wird ermittelt …</>}
        {phase === "submitting" && <><Loader2 className="w-5 h-5 animate-spin" />Prüfe Standort …</>}
        {(phase === "idle" || phase === "error") && <><Navigation className="w-5 h-5" />Jetzt einchecken</>}
        {phase === "success" && <><CheckCircle2 className="w-5 h-5" />Erfolgreich!</>}
      </button>

      {IS_DEV && phase !== "success" && (
        <button
          type="button"
          onClick={handleDevCheckIn}
          disabled={phase === "submitting"}
          className="flex items-center justify-center gap-2 rounded-2xl px-6 py-3 text-sm font-semibold border-2 border-dashed transition-all disabled:opacity-50"
          style={{ borderColor: "var(--oz-brand-orange, #f97316)", color: "var(--oz-brand-orange, #f97316)" }}
        >
          <FlaskConical className="w-4 h-4" />
          Testmodus: Simuliere Check-in
        </button>
      )}

      {message && phase === "error" && (
        <div className="flex items-start gap-2 rounded-xl p-3 bg-red-50 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{message}</span>
        </div>
      )}

      {message && phase === "success" && (
        <div
          className="flex items-start gap-2 rounded-xl p-3 text-sm"
          style={{ background: "var(--oz-brand-green-light)", color: "var(--oz-brand-green)" }}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{message}</span>
        </div>
      )}

      {showPrivacyNote && <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1">
        <MapPin className="w-3 h-3" />
        <span>
          Standort nur für diesen Check-in.{" "}
          <a href="/#/datenschutz" className="underline" style={{ color: "var(--oz-brand-green)" }}>
            Datenschutz
          </a>
        </span>
      </p>}
    </div>
  );
}
