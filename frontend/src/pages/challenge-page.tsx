import { ArrowLeft, Camera, CheckCircle2, ClipboardList, Clock, ExternalLink, HelpCircle, MapPin, Star, Trophy, Zap } from "lucide-react";

const MASCOTS = [
  "/images/maskottchen/fynn_plain.webp",
  "/images/maskottchen/horst_plain.webp",
  "/images/maskottchen/kreiselix_plain.webp",
  "/images/maskottchen/nico_plain.webp",
  "/images/maskottchen/paul_plain.webp",
  "/images/maskottchen/quirin_plain.webp",
  "/images/maskottchen/tuxi_plain.webp",
];
import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { fetchChallenge, submitPhoto } from "../api/client";
import { ChallengeMap, type UserPosition } from "../components/challenge-map";
import { CheckInButton } from "../components/checkin-button";
import { SuccessModal } from "../components/success-modal";
import { externalMapUrl } from "../lib/maps";
import { BONUS_FIRST_CHECKIN, BONUS_FIRST_DAY, type Challenge, type CheckInResponse, calcMaxPoints } from "../types";

export function ChallengePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPreview = searchParams.get("preview") === "1";
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successResponse, setSuccessResponse] = useState<CheckInResponse | null>(null);
  const [checkedIn, setCheckedIn] = useState(false);
  const [userPosition, setUserPosition] = useState<UserPosition | null>(null);
  const [quizAnswer, setQuizAnswer] = useState<number | null>(null);
  const [photoRequired, setPhotoRequired] = useState(false);
  const [photoStatus, setPhotoStatus] = useState<string | null | undefined>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    setSuccessResponse(null);
    setCheckedIn(false);
    setUserPosition(null);
    setQuizAnswer(null);
    setPhotoRequired(false);
    setPhotoStatus(null);
    setPhotoError(null);
    fetchChallenge(Number(id), isPreview)
      .then((c) => {
        setChallenge(c);
        setCheckedIn(c.user_checked_in ?? false);
        if (c.is_photo) setPhotoStatus(c.photo_submission_status ?? null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  function handleSuccess(response: CheckInResponse) {
    setCheckedIn(true);
    if (response.photo_required) {
      setPhotoRequired(true);
    } else {
      setSuccessResponse(response);
    }
  }

  async function handlePhotoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !challenge) return;
    setPhotoError(null);
    setPhotoUploading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await submitPhoto(challenge.id, base64);
      setPhotoStatus("pending");
      setPhotoRequired(false);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Upload fehlgeschlagen.");
    } finally {
      setPhotoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  if (loading) {
    return (
      <div className="max-w-[480px] mx-auto">
        <div className="bg-gray-200 animate-pulse" style={{ height: "280px" }} />
        <div className="px-4 pt-4 space-y-3">
          <div className="bg-white rounded-2xl h-40 animate-pulse" />
          <div className="bg-white rounded-2xl h-24 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !challenge) {
    return (
      <div className="max-w-[480px] mx-auto px-4 pt-6 text-center">
        <p className="text-red-600 font-semibold">{error ?? "Challenge nicht gefunden"}</p>
        <button type="button" onClick={() => navigate(-1)} className="mt-4 text-sm underline">
          Zurück
        </button>
      </div>
    );
  }

  const maxPts = calcMaxPoints(challenge);

  return (
    <div className="max-w-[480px] mx-auto pb-24 md:pb-6">

      {/* ── Hero: Bild + Overlay ── */}
      <div className="relative mx-4 rounded-2xl overflow-hidden" style={{ height: "280px" }}>
        {challenge.place.image_url ? (
          <img
            src={challenge.place.image_url}
            alt={challenge.place.title}
            className="w-full h-full object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full" style={{ background: "linear-gradient(135deg, var(--oz-brand-green) 0%, #007a00 100%)" }} />
        )}

        {/* Gradient-Overlay unten */}
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.25) 0%, transparent 40%, rgba(0,0,0,0.65) 100%)" }}
        />

        {/* Back-Button oben links */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 flex items-center gap-1.5 text-sm font-bold text-white rounded-full px-4 py-2 active:scale-95"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", border: "1.5px solid rgba(255,255,255,0.3)" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Zurück
        </button>

        {/* Punkte-Badge oben rechts */}
        {!checkedIn && (
          <div
            className="absolute top-4 right-4 flex items-center gap-1 text-sm font-black text-white rounded-full px-3 py-1.5"
            style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}
          >
            <Star className="w-4 h-4 text-yellow-300 fill-yellow-300" />
            bis {maxPts} Pkt.
          </div>
        )}

        {/* Maskottchen unten rechts */}
        <div className="absolute bottom-0 right-3" style={{ width: "80px", height: "100px" }}>
          <img
            src={MASCOTS[challenge.id % MASCOTS.length]}
            alt="Maskottchen"
            className="w-full h-full object-contain object-bottom"
            style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.25))" }}
          />
        </div>

        {/* Titel unten im Bild */}
        <div className="absolute bottom-0 left-0 right-16 px-4 pb-4">
          {challenge.day_number && (
            <p className="text-xs font-bold text-white/70 uppercase tracking-widest mb-1">
              Tag {challenge.day_number}
            </p>
          )}
          <h1
            className="text-2xl font-black text-white leading-tight"
            style={{ fontFamily: "var(--oz-font-heading)", textShadow: "0 1px 4px rgba(0,0,0,0.4)" }}
          >
            {challenge.title}
          </h1>
          <p className="text-sm text-white/80 mt-0.5">{challenge.description}</p>
        </div>
      </div>

      <div className="px-4 space-y-3 pt-4">

        {/* ── Vorschau-Banner ── */}
        {isPreview && (
          <div className="rounded-2xl px-4 py-3 flex items-center gap-2 text-sm font-semibold" style={{ background: "#fef9c3", border: "1px solid #fde047", color: "#854d0e" }}>
            <span>👁</span> Vorschau-Modus – nur für Admins sichtbar
          </div>
        )}

        {/* ── Foto abgelehnt – prominent oben ── */}
        {challenge.is_photo && checkedIn && photoStatus === "rejected" && (
          <div className="rounded-2xl overflow-hidden" style={{ border: "2px solid #dc2626" }}>
            <div className="bg-red-600 px-4 py-3 flex items-center gap-2">
              <Camera className="w-4 h-4 text-white shrink-0" />
              <p className="font-bold text-sm text-white">Dein Foto wurde abgelehnt</p>
            </div>
            <div className="bg-white px-4 py-4">
              {challenge.photo_admin_message && (
                <p className="text-sm text-red-800 bg-red-50 rounded-xl px-3 py-2 mb-3 leading-relaxed font-medium">
                  {challenge.photo_admin_message}
                </p>
              )}
              <p className="text-sm text-gray-700 mb-4 leading-relaxed">
                Du kannst jetzt ein neues Foto einreichen.
              </p>
              {photoError && <p className="text-xs text-red-600 mb-3">{photoError}</p>}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoFileChange}
              />
              <button
                type="button"
                disabled={photoUploading}
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50"
                style={{ background: "#dc2626" }}
              >
                <Camera className="w-4 h-4" />
                {photoUploading ? "Wird hochgeladen …" : "Neues Foto einreichen"}
              </button>
            </div>
          </div>
        )}

        {/* ── Mystery-Banner ── */}
        {challenge.is_mystery && !checkedIn && (
          <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: "#f3f0ff", border: "1px solid #c4b5fd" }}>
            <HelpCircle className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "#7c3aed" }} />
            <div>
              <p className="text-sm font-bold" style={{ color: "#5b21b6" }}>Mystery-Ort</p>
              <p className="text-xs mt-0.5" style={{ color: "#6d28d9" }}>
                Erkunde Zirndorf und finde diesen Ort anhand des Bildes und der Beschreibung.
                {challenge.mystery_attempts_left != null && (
                  <> Heute noch <strong>{challenge.mystery_attempts_left}</strong> {challenge.mystery_attempts_left === 1 ? "Versuch" : "Versuche"} übrig.</>
                )}
              </p>
            </div>
          </div>
        )}

        {/* ── Aufgaben-Banner ── */}
        {challenge.is_task && !checkedIn && (
          <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: "#fef2f2", border: "1px solid #fca5a5" }}>
            <ClipboardList className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
            <div>
              <p className="text-sm font-bold text-red-700">Aufgaben-Stop</p>
              <p className="text-xs mt-0.5 text-red-600">
                Löse das Rätsel bzw. erledige die Aufgabe in der Beschreibung – dann check am richtigen Ort ein.
              </p>
            </div>
          </div>
        )}

        {/* ── Foto-Banner (vor Check-in) ── */}
        {challenge.is_photo && !checkedIn && (
          <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: "#1a1a1a", border: "1px solid #333" }}>
            <Camera className="w-5 h-5 shrink-0 mt-0.5 text-white" />
            <div>
              <p className="text-sm font-bold text-white">Foto-Stop</p>
              <p className="text-xs mt-0.5 text-gray-300">
                Check zuerst per GPS ein – dann lädst du ein Foto hoch. Du erhältst die Punkte, sobald das Foto freigegeben wurde.
              </p>
            </div>
          </div>
        )}

        {/* ── Foto-Upload (nach GPS-Check-in, Foto noch ausstehend) ── */}
        {challenge.is_photo && checkedIn && (photoRequired || (!photoStatus)) && (
          <div className="bg-white rounded-2xl p-5" style={{ boxShadow: "var(--oz-shadow)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Camera className="w-5 h-5" style={{ color: "#1a1a1a" }} />
              <p className="font-bold text-sm">Foto hochladen</p>
            </div>
            <p className="text-xs text-gray-600 mb-4 leading-relaxed">
              Dein Standort wurde bestätigt! Lade jetzt ein Foto hoch, das beweist, dass du wirklich vor Ort warst. Punkte gibt es nach der Freigabe.
            </p>
            {photoError && <p className="text-xs text-red-600 mb-3">{photoError}</p>}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handlePhotoFileChange}
            />
            <button
              type="button"
              disabled={photoUploading}
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold text-white disabled:opacity-50"
              style={{ background: "#1a1a1a" }}
            >
              <Camera className="w-4 h-4" />
              {photoUploading ? "Wird hochgeladen …" : "Foto aufnehmen / auswählen"}
            </button>
          </div>
        )}

        {/* ── Foto in Prüfung ── */}
        {challenge.is_photo && checkedIn && photoStatus === "pending" && (
          <div className="rounded-2xl p-4 flex items-start gap-3 bg-yellow-50" style={{ border: "1px solid #fde68a" }}>
            <Clock className="w-5 h-5 shrink-0 mt-0.5 text-yellow-600" />
            <div>
              <p className="text-sm font-bold text-yellow-800">Foto in Prüfung</p>
              <p className="text-xs mt-0.5 text-yellow-700">
                Dein Foto wurde eingereicht und wird geprüft. Du erhältst deine Punkte nach der Freigabe.
              </p>
            </div>
          </div>
        )}


        {/* ── Foto freigegeben ── */}
        {challenge.is_photo && checkedIn && photoStatus === "approved" && (
          <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: "var(--oz-brand-green-light)", border: "1px solid var(--oz-brand-green)" }}>
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" style={{ color: "var(--oz-brand-green)" }} />
            <div>
              <p className="text-sm font-bold" style={{ color: "var(--oz-brand-green)" }}>Foto freigegeben!</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--oz-brand-green)" }}>
                Dein Foto wurde akzeptiert und die Punkte wurden gutgeschrieben.
              </p>
            </div>
          </div>
        )}

        {/* ── Karte (nur für normale Challenges) ── */}
        {!challenge.is_mystery && (
          <div className="rounded-2xl overflow-hidden" style={{ boxShadow: "var(--oz-shadow)" }}>
            <ChallengeMap place={challenge.place} height="180px" userPosition={userPosition} />
            <div className="bg-white px-4 py-2 flex items-center justify-between">
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {challenge.place.title} · {challenge.place.radius_m} m Radius
              </span>
              <a
                href={externalMapUrl(challenge.place)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs flex items-center gap-1 no-underline font-medium"
                style={{ color: "var(--oz-brand-green)" }}
              >
                In App öffnen
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        {/* ── Quiz ── */}
        {challenge.quiz_question && challenge.quiz_options && !checkedIn && (
          <div className="bg-white rounded-2xl p-4" style={{ boxShadow: "var(--oz-shadow)" }}>
            <p className="text-sm font-bold mb-3 text-gray-900">{challenge.quiz_question}</p>
            <div className="space-y-2">
              {challenge.quiz_options.map((option, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setQuizAnswer(i)}
                  className="w-full text-left rounded-xl px-4 py-3 text-sm border-2 transition-all"
                  style={
                    quizAnswer === i
                      ? { borderColor: "var(--oz-brand-green)", background: "var(--oz-brand-green-light)", fontWeight: 600 }
                      : { borderColor: "#e5e7eb", background: "#fff" }
                  }
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Check-in + Punkte ── */}
        {!(challenge.is_photo && checkedIn) && (
        <div className="bg-white rounded-2xl p-4" style={{ boxShadow: "var(--oz-shadow)" }}>
          {!checkedIn && (
            <div className="flex gap-2 text-xs mb-3">
              <span className="flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold bg-yellow-50 text-yellow-700">
                <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                {challenge.points} Punkte
              </span>
              {challenge.checkin_count === 0 && (
                <span className="flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold bg-orange-50 text-orange-600">
                  <Trophy className="w-3.5 h-3.5" />
                  Erster +{BONUS_FIRST_CHECKIN}
                </span>
              )}
              {challenge.first_day_active && (
                <span className="flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold bg-blue-50 text-blue-600">
                  <Zap className="w-3.5 h-3.5" />
                  +{BONUS_FIRST_DAY} in den ersten 2 Tagen
                </span>
              )}
            </div>
          )}
          <CheckInButton
            key={challenge.id}
            challengeId={challenge.id}
            place={challenge.place}
            alreadyCheckedIn={checkedIn}
            onSuccess={handleSuccess}
            onPositionObtained={setUserPosition}
            showPrivacyNote={false}
            quizAnswerIndex={challenge.quiz_question ? quizAnswer : undefined}
          />
        </div>
        )}

        {/* ── Story ── */}
        {challenge.story && (
          <div className="bg-white rounded-2xl p-5" style={{ boxShadow: "var(--oz-shadow)" }}>
            <h2 className="font-bold text-base mb-3" style={{ fontFamily: "var(--oz-font-heading)" }}>
              Über diesen Ort
            </h2>
            {challenge.story.split("\n\n").map((para, i) => (
              <p key={i} className="text-sm text-gray-700 leading-relaxed mb-2 last:mb-0">{para}</p>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 text-center pb-2">
          Standort wird nur beim Check-in abgefragt. Keine Routenaufzeichnung.{" "}
          <a href="/#/datenschutz" className="underline" style={{ color: "var(--oz-brand-green)" }}>
            Datenschutz
          </a>
        </p>
      </div>

      {successResponse && (
        <SuccessModal
          response={successResponse}
          challengeTitle={challenge.title}
          onClose={() => setSuccessResponse(null)}
        />
      )}
    </div>
  );
}
