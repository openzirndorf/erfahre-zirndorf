import { Award, Bike, Copy, LogIn, MapPin, Star, Trash2, UserPlus } from "lucide-react";
import { ShareButton } from "../components/share-button";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch } from "../api/client";
import { fetchMyProgress } from "../api/client";
import { OzFooter } from "../components/oz-footer";
import type { AuthState, UserProgress } from "../types";

const MILESTONES = [1, 5, 10, 15, 25];

function getAuth(): AuthState | null {
  try { return JSON.parse(localStorage.getItem("auth") ?? "null"); } catch { return null; }
}

function MilestoneBar({ count }: { count: number }) {
  const next = MILESTONES.find((m) => m > count) ?? 25;
  const prev = MILESTONES.filter((m) => m <= count).at(-1) ?? 0;
  const pct = next === prev ? 100 : ((count - prev) / (next - prev)) * 100;

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
        <span>{count} Check-ins</span>
        <span>Nächstes Ziel: {next}</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${Math.min(pct, 100)}%`,
            background: "linear-gradient(90deg, var(--oz-brand-green), #7ecf00)",
          }}
        />
      </div>
      <div className="flex justify-between mt-1">
        {MILESTONES.map((m) => (
          <div key={m} className="flex flex-col items-center">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: count >= m ? "var(--oz-brand-green)" : "#d1d5db" }}
            />
            <span className="text-[10px] text-gray-400 mt-0.5">{m}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProfilePage() {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationAuto, setLocationAuto] = useState(
    localStorage.getItem("oz_location_auto") === "true"
  );
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const auth = getAuth();

  async function handleDeleteAccount() {
    if (!deleteConfirm) { setDeleteConfirm(true); return; }
    setDeleting(true);
    try {
      await apiFetch("/api/users/me", { method: "DELETE" });
      localStorage.removeItem("auth");
      window.location.href = "/";
    } catch {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  }

  function toggleLocationAuto() {
    const next = !locationAuto;
    setLocationAuto(next);
    localStorage.setItem("oz_location_auto", String(next));
  }

  useEffect(() => {
    if (!auth) { setLoading(false); return; }
    fetchMyProgress()
      .then(setProgress)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (!auth) {
    return (
      <div className="max-w-[480px] mx-auto px-4 pt-8 pb-24">
        <div
          className="rounded-2xl p-6 text-white mb-6 text-center"
          style={{ background: "linear-gradient(135deg, var(--oz-brand-green) 0%, #007a00 100%)" }}
        >
          <Bike className="w-12 h-12 mx-auto mb-3 opacity-80" />
          <h1 className="text-xl font-black mb-1" style={{ fontFamily: "var(--oz-font-heading)" }}>
            Mach mit!
          </h1>
          <p className="text-sm opacity-85">
            Sammle Punkte, sichere dir Badges und sieh deinen Fortschritt auf der Rangliste.
          </p>
        </div>

        <div className="space-y-3">
          <Link
            to="/registrieren"
            className="flex items-center justify-center gap-2 w-full rounded-2xl py-4 font-bold text-white text-base no-underline"
            style={{ background: "var(--oz-brand-green)" }}
          >
            Jetzt registrieren
          </Link>
          <Link
            to="/anmelden"
            className="flex items-center justify-center gap-2 w-full rounded-2xl py-4 font-bold border-2 text-base no-underline"
            style={{ borderColor: "var(--oz-brand-green)", color: "var(--oz-brand-green)" }}
          >
            <LogIn className="w-5 h-5" />
            Bereits registriert? Anmelden
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-[480px] mx-auto px-4 pt-6 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-2xl animate-pulse" style={{ height: i === 1 ? 96 : i === 2 ? 120 : 80 }} />
        ))}
      </div>
    );
  }

  if (error || !progress) {
    return (
      <div className="max-w-[480px] mx-auto px-4 pt-6 text-center space-y-4">
        <p className="text-red-600">{error ?? "Fehler beim Laden"}</p>
        {auth && (
          <button
            type="button"
            onClick={() => { localStorage.removeItem("auth"); window.location.reload(); }}
            className="w-full rounded-2xl py-3 text-sm font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            Abmelden und neu anmelden
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-[480px] mx-auto pb-24 md:pb-6">
      <div className="px-4 pt-6 space-y-4">

        {/* Header */}
        <div
          className="rounded-2xl p-5 text-white"
          style={{ background: "linear-gradient(135deg, var(--oz-brand-green) 0%, #007a00 100%)" }}
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-black text-green-800 bg-white/90 shrink-0">
              {progress.display_name[0]?.toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-black" style={{ fontFamily: "var(--oz-font-heading)" }}>
                {progress.display_name}
              </h1>
              <div className="flex items-center gap-1 mt-0.5">
                <Star className="w-4 h-4 text-yellow-300 fill-yellow-300" />
                <span className="font-bold text-lg">{progress.points}</span>
                <span className="text-sm opacity-75">Punkte</span>
              </div>
            </div>
          </div>
          <MilestoneBar count={progress.checkin_count} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 flex items-center gap-3" style={{ boxShadow: "var(--oz-shadow)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "var(--oz-brand-green-light)" }}>
              <Bike className="w-5 h-5" style={{ color: "var(--oz-brand-green)" }} />
            </div>
            <div>
              <p className="text-2xl font-black" style={{ fontFamily: "var(--oz-font-heading)" }}>
                {progress.checkin_count}
              </p>
              <p className="text-xs text-gray-500">Check-ins</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 flex items-center gap-3" style={{ boxShadow: "var(--oz-shadow)" }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-purple-50">
              <Award className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-2xl font-black" style={{ fontFamily: "var(--oz-font-heading)" }}>
                {progress.badges.length}
              </p>
              <p className="text-xs text-gray-500">Badges</p>
            </div>
          </div>
        </div>

        {/* Badges */}
        {progress.badges.length > 0 && (
          <div className="bg-white rounded-2xl p-5" style={{ boxShadow: "var(--oz-shadow)" }}>
            <h2
              className="font-bold text-base mb-3 flex items-center gap-2"
              style={{ fontFamily: "var(--oz-font-heading)" }}
            >
              <Award className="w-4 h-4 text-purple-500" />
              Meine Badges
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {progress.badges.map((badge) => (
                <div
                  key={badge.id}
                  className="flex items-center gap-2 rounded-xl p-3"
                  style={{ background: "var(--oz-brand-green-light)" }}
                >
                  <span className="text-xl shrink-0">{badge.icon}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-gray-800 leading-tight truncate">
                      {badge.title}
                    </p>
                    <p className="text-xs text-gray-500 leading-tight truncate">
                      {badge.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <ShareButton
          text={`Ich habe schon ${progress.checkin_count} Orte bei Erfahre Zirndorf per Rad besucht! 🚴 ${progress.points} Punkte`}
          compact={false}
        />

        {progress.referral_code && (
          <div className="bg-white rounded-2xl p-5" style={{ boxShadow: "var(--oz-shadow)" }}>
            <h2 className="font-bold text-base mb-1 flex items-center gap-2" style={{ fontFamily: "var(--oz-font-heading)" }}>
              <UserPlus className="w-4 h-4" style={{ color: "var(--oz-brand-green)" }} />
              Freunde einladen
            </h2>
            <p className="text-xs text-gray-500 mb-3 leading-relaxed">
              Teile deinen Code – du erhältst <strong>20 Punkte</strong> pro Anmeldung und <strong>40 weitere</strong>, sobald dein Geworbener 100 Punkte erreicht.
            </p>
            {(progress.referrals_registered ?? 0) > 0 && (
              <div className="flex gap-3 mb-3">
                <div className="flex-1 rounded-xl p-3 text-center" style={{ background: "var(--oz-brand-green-light)" }}>
                  <p className="text-lg font-black" style={{ fontFamily: "var(--oz-font-heading)", color: "var(--oz-brand-green)" }}>
                    {progress.referrals_registered}
                  </p>
                  <p className="text-xs text-gray-500">eingeladen (+{(progress.referrals_registered ?? 0) * 20} Pkt.)</p>
                </div>
                <div className="flex-1 rounded-xl p-3 text-center" style={{ background: "var(--oz-brand-green-light)" }}>
                  <p className="text-lg font-black" style={{ fontFamily: "var(--oz-font-heading)", color: "var(--oz-brand-green)" }}>
                    {progress.referrals_milestone}
                  </p>
                  <p className="text-xs text-gray-500">× 100 Pkt. (+{(progress.referrals_milestone ?? 0) * 40} Pkt.)</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-xl p-3" style={{ background: "var(--oz-brand-green-light)" }}>
              <span className="flex-1 font-mono font-bold tracking-widest text-center text-gray-800 text-sm">
                {progress.referral_code}
              </span>
              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}${window.location.pathname}#/registrieren?ref=${progress.referral_code}`;
                  navigator.clipboard.writeText(url).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  });
                }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shrink-0 transition-colors"
                style={{ background: copied ? "#007a00" : "var(--oz-brand-green)" }}
              >
                <Copy className="w-3.5 h-3.5" />
                {copied ? "Kopiert!" : "Link kopieren"}
              </button>
            </div>
          </div>
        )}

        {/* Einstellungen */}
        <div className="bg-white rounded-2xl p-5" style={{ boxShadow: "var(--oz-shadow)" }}>
          <h2 className="font-bold text-base mb-3" style={{ fontFamily: "var(--oz-font-heading)" }}>
            Einstellungen
          </h2>
          <button
            type="button"
            onClick={toggleLocationAuto}
            className="w-full flex items-center justify-between gap-3 rounded-xl p-3 transition-colors"
            style={{ background: "var(--oz-bg-surface)" }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: locationAuto ? "var(--oz-brand-green-light)" : "#f3f4f6" }}>
                <MapPin className="w-4 h-4" style={{ color: locationAuto ? "var(--oz-brand-green)" : "#9ca3af" }} />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-800">Standort automatisch</p>
                <p className="text-xs text-gray-500">
                  {locationAuto ? "GPS wird beim Check-in gecacht (schneller)" : "GPS wird bei jedem Check-in neu abgefragt"}
                </p>
              </div>
            </div>
            <div
              className="w-11 h-6 rounded-full relative shrink-0 transition-colors duration-200"
              style={{ background: locationAuto ? "var(--oz-brand-green)" : "#d1d5db" }}
            >
              <div
                className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                style={{ transform: locationAuto ? "translateX(20px)" : "translateX(2px)" }}
              />
            </div>
          </button>
        </div>

        <button
          type="button"
          onClick={() => { localStorage.removeItem("auth"); window.location.reload(); }}
          className="w-full rounded-2xl py-3 text-sm font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          Abmelden
        </button>

        <button
          type="button"
          onClick={handleDeleteAccount}
          disabled={deleting}
          className="w-full rounded-2xl py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2"
          style={deleteConfirm
            ? { background: "#fee2e2", color: "#dc2626", border: "1px solid #fca5a5" }
            : { color: "#9ca3af", border: "1px solid #e5e7eb" }
          }
        >
          <Trash2 className="w-4 h-4" />
          {deleting ? "Wird gelöscht…" : deleteConfirm ? "Wirklich löschen? Nochmal tippen zum Bestätigen" : "Konto löschen"}
        </button>
      </div>

      <div className="mt-6">
        <OzFooter />
      </div>
    </div>
  );
}
