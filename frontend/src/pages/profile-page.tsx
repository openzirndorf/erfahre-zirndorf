import { Award, Bike, Bell, Copy, ExternalLink, Gift, LogIn, MapPin, MessageCircle, Star, Trash2, UserPlus } from "lucide-react";
import { ShareButton } from "../components/share-button";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { apiFetch, updateNewsletterConsent, submitRating, fetchMyPrizes, claimPrize } from "../api/client";
import { fetchMyProgress } from "../api/client";
import { OzFooter } from "../components/oz-footer";
import type { AuthState, UserProgress, UserPrize } from "../types";

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
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [newsletterConsent, setNewsletterConsent] = useState(false);
  const [myRating, setMyRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [prizes, setPrizes] = useState<UserPrize[]>([]);
  const [claimConfirm, setClaimConfirm] = useState<number | null>(null);
  const [claiming, setClaiming] = useState<number | null>(null);
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
      .then((p) => { setProgress(p); setNewsletterConsent(p.newsletter_consent ?? false); setMyRating(p.my_rating ?? null); })
    fetchMyPrizes().then(setPrizes).catch(() => {});
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

        {progress.referral_code && (() => {
          const referralUrl = `${window.location.origin}${window.location.pathname}#/registrieren?ref=${progress.referral_code}`;
          const limitReached = (progress.referrals_registered ?? 0) >= 5;
          return (
            <div className="bg-white rounded-2xl p-5" style={{ boxShadow: "var(--oz-shadow)" }}>
              <h2 className="font-bold text-base mb-1 flex items-center gap-2" style={{ fontFamily: "var(--oz-font-heading)" }}>
                <UserPlus className="w-4 h-4" style={{ color: "var(--oz-brand-green)" }} />
                Freunde einladen
              </h2>

              {limitReached ? (
                <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                  Du hast das Maximum von <strong>5 Einladungen</strong> erreicht. Super gemacht!
                </p>
              ) : (
                <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                  Teile deinen Code – du erhältst <strong>20 Punkte</strong> pro Anmeldung und <strong>40 weitere</strong>, sobald dein Geworbener 100 Punkte erreicht. Maximal 5 Einladungen.
                </p>
              )}

              {(progress.referrals_registered ?? 0) > 0 && (
                <div className="flex gap-3 mb-3">
                  <div className="flex-1 rounded-xl p-3 text-center" style={{ background: "var(--oz-brand-green-light)" }}>
                    <p className="text-lg font-black" style={{ fontFamily: "var(--oz-font-heading)", color: "var(--oz-brand-green)" }}>
                      {progress.referrals_registered}/5
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

              <div className="rounded-xl p-3 mb-3 text-center" style={{ background: "var(--oz-brand-green-light)" }}>
                <span className="font-mono font-bold tracking-widest text-gray-800 text-base">
                  {progress.referral_code}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(progress.referral_code!).then(() => {
                      setCopiedCode(true);
                      setTimeout(() => setCopiedCode(false), 2000);
                    });
                  }}
                  className="flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 text-xs font-semibold transition-colors"
                  style={{ background: copiedCode ? "#007a00" : "var(--oz-brand-green)", color: "white" }}
                >
                  <Copy className="w-4 h-4" />
                  {copiedCode ? "Kopiert!" : "Code"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(referralUrl).then(() => {
                      setCopiedLink(true);
                      setTimeout(() => setCopiedLink(false), 2000);
                    });
                  }}
                  className="flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 text-xs font-semibold transition-colors"
                  style={{ background: copiedLink ? "#007a00" : "var(--oz-brand-green)", color: "white" }}
                >
                  <ExternalLink className="w-4 h-4" />
                  {copiedLink ? "Kopiert!" : "Link"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const text = encodeURIComponent(`Entdecke Zirndorf mit dem Rad! 🚴 Mach bei "Erfahre Zirndorf" mit – hier ist mein Einladungslink: ${referralUrl}`);
                    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener");
                  }}
                  className="flex flex-col items-center gap-1 rounded-xl py-2.5 px-1 text-xs font-semibold text-white transition-colors"
                  style={{ background: "#25D366" }}
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </button>
              </div>
            </div>
          );
        })()}

        {/* Verlosungshinweis */}
        {progress.points >= 100 && (
          <div className="rounded-2xl p-4 flex items-start gap-3" style={{ background: "#fefce8", border: "1px solid #fde68a" }}>
            <Gift className="w-5 h-5 shrink-0 mt-0.5 text-yellow-600" />
            <div>
              <p className="text-sm font-bold text-yellow-800">Du nimmst an der Verlosung teil!</p>
              <p className="text-xs mt-0.5 text-yellow-700 leading-relaxed">
                Gewinnübergabe: <strong>Montag, 13. Juli · 19:30 Uhr · Hotel Knorz.</strong>{" "}
                Preise müssen innerhalb von 4 Wochen abgeholt werden.
              </p>
            </div>
          </div>
        )}

        {/* Gewinne */}
        {prizes.length > 0 && (
          <div className="bg-white rounded-2xl overflow-hidden" style={{ boxShadow: "var(--oz-shadow)" }}>
            <div className="px-5 py-3 flex items-center gap-2" style={{ background: "linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)" }}>
              <Gift className="w-4 h-4 text-white shrink-0" />
              <p className="text-white text-sm font-bold">Deine Gewinne</p>
            </div>
            <div className="divide-y divide-gray-100">
              {prizes.map((prize) => {
                const confirmed = !!prize.admin_confirmed_at;
                const claimed = !!prize.user_claimed_at;
                const isConfirming = claimConfirm === prize.id;
                return (
                  <div key={prize.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-gray-900">{prize.title}</p>
                        {prize.sponsor && <p className="text-xs text-gray-400">von {prize.sponsor}</p>}
                        {prize.description && <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{prize.description}</p>}
                      </div>
                      {confirmed ? (
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold bg-green-100 text-green-700">Abgeholt ✓</span>
                      ) : claimed ? (
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700">Warte auf Bestätigung</span>
                      ) : (
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-700">Abzuholen</span>
                      )}
                    </div>

                    {!claimed && !confirmed && !isConfirming && (
                      <button
                        type="button"
                        onClick={() => setClaimConfirm(prize.id)}
                        className="mt-2 w-full rounded-xl py-2 text-sm font-bold text-white"
                        style={{ background: "#7c3aed" }}
                      >
                        Gewinn abholen
                      </button>
                    )}

                    {isConfirming && (
                      <div className="mt-2 rounded-xl p-3" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
                        <p className="text-xs font-bold text-red-800 mb-1">⚠️ Nur vor Ort klicken!</p>
                        <p className="text-xs text-red-700 leading-relaxed mb-3">
                          Dieser Button bestätigt, dass du deinen Gewinn gerade persönlich abholst.
                          <strong> Wenn du ihn vorab anklickst, erlischt dein Anspruch.</strong>
                        </p>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setClaimConfirm(null)}
                            className="flex-1 rounded-xl py-2 text-xs font-bold bg-gray-100 text-gray-700"
                          >
                            Abbrechen
                          </button>
                          <button
                            type="button"
                            disabled={claiming === prize.id}
                            onClick={async () => {
                              setClaiming(prize.id);
                              try {
                                await claimPrize(prize.id);
                                setPrizes((prev) => prev.map((p) =>
                                  p.id === prize.id ? { ...p, user_claimed_at: new Date().toISOString() } : p
                                ));
                                setClaimConfirm(null);
                              } finally {
                                setClaiming(null);
                              }
                            }}
                            className="flex-1 rounded-xl py-2 text-xs font-bold text-white"
                            style={{ background: "#dc2626" }}
                          >
                            {claiming === prize.id ? "…" : "Ja, ich bin vor Ort"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Sternebewertung */}
        <div className="bg-white rounded-2xl p-5" style={{ boxShadow: "var(--oz-shadow)" }}>
          <h2 className="font-bold text-base mb-0.5" style={{ fontFamily: "var(--oz-font-heading)" }}>
            Wie hat dir die Aktion gefallen?
          </h2>
          <p className="text-xs text-gray-500 mb-4">Dein Feedback hilft uns für zukünftige Aktionen.</p>
          <div className="flex justify-center gap-3 mb-3">
            {[1, 2, 3, 4, 5].map((star) => {
              const filled = star <= (hoverRating ?? myRating ?? 0);
              return (
                <button
                  key={star}
                  type="button"
                  onClick={async () => {
                    setMyRating(star);
                    setRatingSubmitted(false);
                    try {
                      await submitRating(star);
                      setRatingSubmitted(true);
                    } catch { /* ignore */ }
                  }}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  className="transition-transform active:scale-110 hover:scale-110"
                  aria-label={`${star} Stern${star !== 1 ? "e" : ""}`}
                >
                  <Star
                    className="w-9 h-9 transition-colors"
                    style={{ color: filled ? "#f59e0b" : "#d1d5db", fill: filled ? "#f59e0b" : "none" }}
                  />
                </button>
              );
            })}
          </div>
          {ratingSubmitted && (
            <p className="text-center text-sm font-semibold" style={{ color: "var(--oz-brand-green)" }}>
              Danke für dein Feedback!
            </p>
          )}
          {myRating && !ratingSubmitted && (
            <p className="text-center text-xs text-gray-400">
              {"★".repeat(myRating)}{"☆".repeat(5 - myRating)} · jederzeit änderbar
            </p>
          )}
        </div>

        {/* Einstellungen */}
        <div className="bg-white rounded-2xl p-5" style={{ boxShadow: "var(--oz-shadow)" }}>
          <h2 className="font-bold text-base mb-3" style={{ fontFamily: "var(--oz-font-heading)" }}>
            Einstellungen
          </h2>
          <div className="space-y-2">
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

          <button
            type="button"
            onClick={async () => {
              const next = !newsletterConsent;
              setNewsletterConsent(next);
              try { await updateNewsletterConsent(next); } catch { setNewsletterConsent(!next); }
            }}
            className="w-full flex items-center justify-between gap-3 rounded-xl p-3 transition-colors"
            style={{ background: "var(--oz-bg-surface)" }}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: newsletterConsent ? "var(--oz-brand-green-light)" : "#f3f4f6" }}>
                <Bell className="w-4 h-4" style={{ color: newsletterConsent ? "var(--oz-brand-green)" : "#9ca3af" }} />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-800">Über zukünftige Aktionen informieren</p>
                <p className="text-xs text-gray-500">
                  {newsletterConsent ? "Du wirst per E-Mail benachrichtigt" : "Kein Newsletter – jederzeit änderbar"}
                </p>
              </div>
            </div>
            <div
              className="w-11 h-6 rounded-full relative shrink-0 transition-colors duration-200"
              style={{ background: newsletterConsent ? "var(--oz-brand-green)" : "#d1d5db" }}
            >
              <div
                className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                style={{ transform: newsletterConsent ? "translateX(20px)" : "translateX(2px)" }}
              />
            </div>
          </button>
          </div>
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
