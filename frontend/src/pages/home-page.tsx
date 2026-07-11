import { Bike, Camera, CheckCircle2, Clock, Gift, LayoutList, Lock, MapPin, Trophy } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchChallenges, fetchTodayChallenges, fetchMyPrizes, claimPrize } from "../api/client";
import { ChallengeCard } from "../components/challenge-card";
import { OzFooter } from "../components/oz-footer";
import { UpdateNotifier, useUpdateNotifier } from "../components/update-notifier";
import { type Challenge, calcMaxPoints, type UserPrize } from "../types";

function getAuth() {
  try { return JSON.parse(localStorage.getItem("auth") ?? "null"); } catch { return null; }
}

const EVENT_START      = new Date("2026-06-06T08:00:00");
const EVENT_END        = new Date("2026-07-12T23:59:59");
const TOTAL_DAYS       = 37;
const LAST_STOP_END    = new Date("2026-07-12T15:00:00"); // Sonntag 14 Uhr, Show bis 15 Uhr
const CEREMONY_END     = new Date("2026-07-13T22:00:00"); // Montag 19:30 Uhr

function useEventState() {
  const now = new Date();
  if (now < EVENT_START) {
    const days = Math.ceil((EVENT_START.getTime() - now.getTime()) / 86_400_000);
    return { phase: "before" as const, day: 0, daysUntil: days };
  }
  if (now > EVENT_END) return { phase: "after" as const, day: TOTAL_DAYS, daysUntil: 0 };
  const day = Math.floor((now.getTime() - EVENT_START.getTime()) / 86_400_000) + 1;
  return { phase: "running" as const, day: Math.min(day, TOTAL_DAYS), daysUntil: 0 };
}


/** Hervorgehobene Karte für die heutige Tageschallenge */
function TodayHero({ challenge }: { challenge: Challenge }) {
  const done = challenge.user_checked_in ?? false;
  const photoPending = challenge.is_photo && challenge.photo_submission_status === "pending";
  const photoRejected = challenge.is_photo && challenge.photo_submission_status === "rejected";
  const photoAwaitingUpload = challenge.is_photo && done && !challenge.photo_submission_status;
  const completed = done && (!challenge.is_photo || challenge.photo_submission_status === "approved");

  const background = photoRejected
    ? "#8b3a3a"
    : photoPending || photoAwaitingUpload
    ? "#8a6d1f"
    : completed
    ? "#4b7c4b"
    : "linear-gradient(135deg, var(--oz-brand-green) 0%, #007a00 100%)";

  return (
    <Link to={`/challenge/${challenge.id}`} className="block no-underline mb-3">
      <div
        className="rounded-2xl overflow-hidden text-white relative"
        style={{ background }}
      >
        <div className="absolute -right-6 -top-6 w-32 h-32 bg-white/5 rounded-full" />
        <div className="absolute -right-2 -bottom-8 w-20 h-20 bg-white/5 rounded-full" />
        <div className="relative p-5">
          <div className="flex items-center gap-2 mb-1">
            {challenge.day_number && (
              <span className="text-xs font-bold opacity-70 uppercase tracking-wide">
                Tag {challenge.day_number} · Tageschallenge
              </span>
            )}
            {!challenge.day_number && (
              <span className="text-xs font-bold opacity-70 uppercase tracking-wide">
                Tageschallenge
              </span>
            )}
          </div>
          <h2 className="text-xl font-black mb-1" style={{ fontFamily: "var(--oz-font-heading)" }}>
            {challenge.title}
          </h2>
          <p className="text-sm opacity-85 line-clamp-2 mb-3">{challenge.description}</p>
          <div className="flex items-center justify-between">
            <span className="text-xs opacity-75">{challenge.place.title}</span>
            {photoRejected ? (
              <span className="flex items-center gap-1 text-sm font-bold bg-white/20 rounded-full px-3 py-1">
                <Camera className="w-4 h-4" /> Foto abgelehnt
              </span>
            ) : photoPending ? (
              <span className="flex items-center gap-1 text-sm font-bold bg-white/20 rounded-full px-3 py-1">
                <Clock className="w-4 h-4" /> Foto in Prüfung
              </span>
            ) : photoAwaitingUpload ? (
              <span className="flex items-center gap-1 text-sm font-bold bg-white/20 rounded-full px-3 py-1">
                <Camera className="w-4 h-4" /> Foto hochladen
              </span>
            ) : completed ? (
              <span className="flex items-center gap-1 text-sm font-bold bg-white/20 rounded-full px-3 py-1">
                <CheckCircle2 className="w-4 h-4" /> Erledigt
              </span>
            ) : (
              <span className="text-sm font-bold bg-white/20 rounded-full px-3 py-1">
                bis {calcMaxPoints(challenge)} Punkte →
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export function HomePage() {
  const [todayChallenges, setTodayChallenges] = useState<Challenge[]>([]);
  const [allChallenges, setAllChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"current" | "all">("current");
  const [prizes, setPrizes] = useState<UserPrize[]>([]);
  const [claimConfirm, setClaimConfirm] = useState<number | null>(null);
  const [claiming, setClaiming] = useState<number | null>(null);
  const event = useEventState();

  useEffect(() => {
    if (getAuth()) fetchMyPrizes().then(setPrizes).catch(() => {});
    setLoading(true);
    Promise.all([fetchTodayChallenges(), fetchChallenges()])
      .then(([today, all]) => {
        setTodayChallenges(today);
        setAllChallenges(all);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const completedToday = todayChallenges.filter((c) => c.user_checked_in).length;

  // "Aktuell": alle freigeschalteten Challenges – unerledigte oben, erledigte unten
  // Die API liefert nur gestartete → kein isFuture-Filter nötig
  const currentChallenges = allChallenges.sort((a, b) => {
    const aDone = a.user_checked_in ? 1 : 0;
    const bDone = b.user_checked_in ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    // Neueste zuerst innerhalb jeder Gruppe
    return new Date(b.start_at).getTime() - new Date(a.start_at).getTime();
  });

  const completedAll = currentChallenges.filter((c) => c.user_checked_in).length;
  const notifier = useUpdateNotifier();
  // Glückwunsch nur wenn alle vergangenen UND heutigen erledigt sind
  const allCurrentDone = currentChallenges.length > 0 && completedAll === currentChallenges.length;
  const progressPct = currentChallenges.length > 0 ? (completedAll / currentChallenges.length) * 100 : 0;

  // Alle heutigen Challenges als Heroes; ältere Challenges darunter als ChallengeCard
  const todayIds = new Set(todayChallenges.map((c) => c.id));
  const currentWithoutToday = currentChallenges.filter((c) => !todayIds.has(c.id));

  const openCount = currentChallenges.filter((c) => !c.user_checked_in).length;

  return (
    <div className="min-h-screen flex flex-col pb-20 md:pb-0">
      <div className="px-4 pt-6 pb-4 max-w-[480px] mx-auto w-full">

        {/* Hero */}
        <div
          className="rounded-2xl p-5 text-white mb-4 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, var(--oz-brand-green) 0%, #007a00 100%)" }}
        >
          <div className="absolute -right-8 -top-8 w-40 h-40 bg-white/5 rounded-full" />
          <div className="absolute -right-2 -bottom-10 w-28 h-28 bg-white/5 rounded-full" />
          <div className="relative">
            <h1 className="text-2xl font-black leading-tight mb-0.5" style={{ fontFamily: "var(--oz-font-heading)" }}>
              Erfahre Zirndorf
            </h1>

            <p className="text-xs opacity-60 mb-1">6. Juni – 12. Juli 2026</p>
            {event.phase === "running" && (
              <p className="text-sm font-semibold opacity-80 mb-4">Tag {event.day} von {TOTAL_DAYS}</p>
            )}
            {event.phase === "before" && (
              <p className="text-sm opacity-80 mb-4">
                Startet in {event.daysUntil} {event.daysUntil === 1 ? "Tag" : "Tagen"}
              </p>
            )}
            {event.phase === "after" && (
              <p className="text-sm opacity-80 mb-4">Die Aktion ist beendet</p>
            )}

            {currentChallenges.length > 0 && !allCurrentDone && (
              <div className="bg-white/15 rounded-xl p-3">
                <div className="flex items-center justify-between text-sm font-semibold mb-2">
                  <span>{completedToday}/{todayChallenges.length} heute · {completedAll}/{currentChallenges.length} gesamt</span>
                </div>
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            )}
            {allCurrentDone && (
              <div className="bg-white/20 rounded-xl p-3 flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 shrink-0" />
                <div>
                  <p className="font-bold text-sm">Alle bisherigen Challenges erledigt!</p>
                  <p className="text-xs opacity-80">Morgen kommt die nächste – gut gemacht!</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Gewinn-Banner */}
        <Link to="/sponsoren" className="no-underline block mb-4">
          <div className="rounded-2xl px-4 py-3 flex items-center gap-3"
            style={{ background: "var(--oz-brand-green-light)" }}>
            <Gift className="w-5 h-5 shrink-0" style={{ color: "var(--oz-brand-green)" }} />
            <p className="text-sm font-semibold" style={{ color: "var(--oz-brand-green)" }}>
              Mitmachen &amp; Preise gewinnen – jetzt Sponsoren ansehen →
            </p>
          </div>
        </Link>

        {/* Letzter Stop – Sonntag 12. Juli 14 Uhr */}
        {new Date() < LAST_STOP_END && (
          <div className="rounded-2xl overflow-hidden mb-4" style={{ border: "2px solid #dc2626" }}>
            <div className="px-4 py-2 flex items-center gap-2" style={{ background: "#dc2626" }}>
              <MapPin className="w-4 h-4 text-white shrink-0" />
              <p className="text-sm font-bold text-white">Letzter Special-Stop · Sonntag 14:00 Uhr</p>
            </div>
            <div className="bg-white px-4 py-3">
              <p className="text-sm text-gray-700 leading-relaxed">
                Die ersten <strong>5 Personen</strong>, die die Aufgabe lösen, erhalten eine Überraschung.
                Wir sind nicht dauerhaft vor Ort – es lohnt sich, schnell zu sein!
              </p>
            </div>
          </div>
        )}

        {/* Gewinnübergabe – Montag 13. Juli 19:30 Uhr */}
        {new Date() < CEREMONY_END && (
          <div className="rounded-2xl overflow-hidden mb-4" style={{ border: "2px solid #7c3aed" }}>
            <div className="px-4 py-2 flex items-center gap-2" style={{ background: "#7c3aed" }}>
              <Trophy className="w-4 h-4 text-white shrink-0" />
              <p className="text-sm font-bold text-white">Gewinnübergabe · Montag, 13. Juli · 19:30 Uhr</p>
            </div>
            <div className="bg-white px-4 py-3">
              <p className="text-sm text-gray-700 leading-relaxed">
                <strong>Hotel Knorz, Zirndorf.</strong> Alle Preise müssen innerhalb von 4 Wochen abgeholt werden.
              </p>
            </div>
          </div>
        )}

        {/* Persönliche Gewinne */}
        {prizes.length > 0 && (
          <div className="rounded-2xl overflow-hidden mb-4" style={{ border: "2px solid #7c3aed" }}>
            <div className="px-4 py-2 flex items-center gap-2" style={{ background: "#7c3aed" }}>
              <Gift className="w-4 h-4 text-white shrink-0" />
              <p className="text-sm font-bold text-white">
                🎁 Du hast {prizes.length === 1 ? "einen Gewinn" : `${prizes.length} Gewinne`}!
              </p>
            </div>
            <div className="bg-white divide-y divide-gray-100">
              {prizes.map((prize) => {
                const confirmed = !!prize.admin_confirmed_at;
                const claimed = !!prize.user_claimed_at;
                const isConfirming = claimConfirm === prize.id;
                return (
                  <div key={prize.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-sm text-gray-900">{prize.title}</p>
                        {prize.sponsor && <p className="text-xs text-gray-400">von {prize.sponsor}</p>}
                        {prize.description && <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{prize.description}</p>}
                      </div>
                      {confirmed ? (
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold bg-green-100 text-green-700">Abgeholt ✓</span>
                      ) : claimed ? (
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700">Bestätigung ausstehend</span>
                      ) : (
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold bg-purple-100 text-purple-700">Abzuholen</span>
                      )}
                    </div>

                    {!claimed && !confirmed && !isConfirming && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-2">
                          Bitte bis spätestens <strong>2. August</strong> zu den regulären Öffnungszeiten abholen – danach verfällt der Anspruch.
                        </p>
                        <button
                          type="button"
                          onClick={() => setClaimConfirm(prize.id)}
                          className="w-full rounded-xl py-2 text-sm font-bold text-white"
                          style={{ background: "#7c3aed" }}
                        >
                          Gewinn abholen
                        </button>
                      </div>
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

        {notifier.show && <UpdateNotifier onDone={notifier.dismiss} />}

        {/* Tabs */}
        <div className="flex rounded-xl bg-gray-100 p-1 mb-4">
          <button
            type="button"
            onClick={() => setTab("current")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-all ${tab === "current" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}
          >
            <Clock className="w-4 h-4" />
            Aktuell
            {openCount > 0 && (
              <span
                className="text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center"
                style={{ background: tab === "current" ? "var(--oz-brand-green)" : "#d1d5db", color: tab === "current" ? "white" : "#6b7280" }}
              >
                {openCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab("all")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-all ${tab === "all" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}
          >
            <LayoutList className="w-4 h-4" />
            Alle Orte
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <div key={i} className="bg-white rounded-2xl h-32 animate-pulse" />)}
          </div>
        ) : tab === "current" ? (
          <div>
            {currentChallenges.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Bike className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-semibold">
                  {event.phase === "before" ? "Startet am 6. Juni" : "Noch nichts gestartet"}
                </p>
              </div>
            ) : (
              <>
                {todayChallenges.length > 0 && (
                  <div className="space-y-3 mb-3">
                    {todayChallenges.map((c) => <TodayHero key={c.id} challenge={c} />)}
                  </div>
                )}
                {currentWithoutToday.length > 0 && (
                  <div className="space-y-3">
                    {currentWithoutToday.map((c) => <ChallengeCard key={c.id} challenge={c} />)}
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {allChallenges.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <p className="font-semibold">Noch keine Challenges angelegt</p>
              </div>
            ) : (
              <>
                {allChallenges
                  .sort((a, b) => {
                    if (a.day_number && b.day_number) return a.day_number - b.day_number;
                    return new Date(a.start_at).getTime() - new Date(b.start_at).getTime();
                  })
                  .map((c) => <ChallengeCard key={c.id} challenge={c} />)}
              </>
            )}
          </div>
        )}
      </div>

      <OzFooter />
    </div>
  );
}
