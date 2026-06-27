import { Ban, CheckCircle2, ClipboardList, Flag, HeartPulse, Info, Pencil, Plus, RotateCcw, Save, Shield, Trash2, Unlock, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { adminFetch } from "../api/client";
import { useToast } from "../components/toast-provider";

const parseUTC = (s: string) => new Date(/Z|[+-]\d{2}:\d{2}$/.test(s) ? s : s + "Z");
const toBerlinInput = (utcIso: string) =>
  parseUTC(utcIso).toLocaleString("sv-SE", { timeZone: "Europe/Berlin" }).replace(" ", "T").slice(0, 16);

interface Place {
  id: number;
  title: string;
  description: string | null;
  lat: number;
  lon: number;
  radius_m: number;
  category: string | null;
  image_url: string | null;
}

interface AdminChallenge {
  id: number;
  place_id: number;
  title: string;
  description: string;
  story: string | null;
  day_number: number | null;
  start_at: string;
  end_at: string;
  points: number;
  category: string | null;
  is_active: boolean;
}

interface Stats {
  users: number;
  successful_checkins: number;
  challenges: number;
  flagged_checkins: number;
  checkins_today: number;
  checkins_yesterday: number;
  total_points: number;
  unanswered_support: number;
}

interface HealthStatus {
  api: string;
  database: string;
  event_status: "upcoming" | "active" | "ended";
  event_start: string;
  event_end: string;
  server_time: string;
  users: number;
  successful_checkins: number;
  flagged_checkins: number;
  challenges: number;
  active_challenges: number;
  last_checkin_at: string | null;
}

interface AdminUser {
  id: number;
  email: string;
  display_name: string;
  points: number;
  manual_checkin_count: number;
  checkin_count: number;
  role: "participant" | "admin";
  is_blocked: boolean;
  blocked_reason: string | null;
  created_at: string;
  referral_code?: string | null;
  referred_by_display_name?: string | null;
  referrals_count?: number;
}

interface FlaggedCheckIn {
  id: number;
  user_id: number;
  user_display_name: string;
  challenge_id: number;
  challenge_title: string;
  checked_in_at: string;
  success: boolean;
  points_awarded: number;
  distance_m: number | null;
  accuracy_m: number | null;
  is_flagged: boolean;
  flag_reason: string | null;
}

interface AuditLogEntry {
  id: number;
  admin_user_id: number | null;
  target_user_id: number | null;
  admin_display_name: string | null;
  action: string;
  details: string | null;
  created_at: string;
}

interface UserDetail {
  user: AdminUser;
  checkins: Array<{
    id: number;
    challenge_id: number;
    challenge_title: string;
    checked_in_at: string;
    success: boolean;
    points_awarded: number;
    distance_m: number | null;
    accuracy_m: number | null;
    is_flagged: boolean;
    flag_reason: string | null;
  }>;
  badges: Array<{ id: number; title: string; icon: string; awarded_at: string }>;
  audit_log: AuditLogEntry[];
}

interface ChallengeCheckInEntry {
  id: number;
  user_id: number;
  user_display_name: string;
  checked_in_at: string;
  points_awarded: number;
  distance_m: number | null;
  accuracy_m: number | null;
  is_flagged: boolean;
}

type Tab = "stats" | "users" | "flags" | "audit" | "places" | "challenges" | "suggestions" | "upcoming";

const BLOCK_REASON_OPTIONS = [
  { label: "Verdächtiger Standort", value: "Verdächtiger Standort: Bitte melde dich bei OpenZirndorf, wenn du glaubst, dass das ein Fehler ist." },
  { label: "Doppelaccount", value: "Doppelaccount: Bitte nutze nur einen Account für die Teilnahme." },
  { label: "Missbrauch", value: "Missbrauch: Der Account wurde wegen Verstoßes gegen die Teilnahmebedingungen gesperrt." },
  { label: "Sonstiges", value: "Bitte wende dich an OpenZirndorf." },
];

function UserDetailPanel({ detail }: { detail?: UserDetail }) {
  const [showAllCheckins, setShowAllCheckins] = React.useState(false);

  if (!detail) {
    return (
      <div className="mt-3 rounded-xl bg-gray-50 p-3 text-xs text-gray-500">
        Details werden geladen …
      </div>
    );
  }

  const successCheckins = detail.checkins.filter((c) => c.success);
  const visibleCheckins = showAllCheckins ? successCheckins : successCheckins.slice(0, 5);

  return (
    <div className="mt-3 space-y-3 rounded-xl bg-gray-50 p-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-white p-2">
          <p className="text-lg font-black">{successCheckins.length}</p>
          <p className="text-[10px] text-gray-500">Erfolge</p>
        </div>
        <div className="rounded-lg bg-white p-2">
          <p className="text-lg font-black">{detail.badges.length}</p>
          <p className="text-[10px] text-gray-500">Badges</p>
        </div>
        <div className="rounded-lg bg-white p-2">
          <p className="text-lg font-black">{detail.checkins.filter((c) => c.is_flagged).length}</p>
          <p className="text-[10px] text-gray-500">Markiert</p>
        </div>
      </div>

      <div>
        <p className="text-xs font-bold text-gray-700 mb-2">Check-ins ({successCheckins.length})</p>
        <div className="space-y-2">
          {visibleCheckins.map((checkin) => (
            <div key={checkin.id} className={`rounded-lg bg-white p-2 text-xs ${checkin.is_flagged ? "ring-1 ring-orange-300" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <span className="font-semibold text-gray-800">{checkin.challenge_title}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] font-mono text-gray-400">#{checkin.challenge_id}</span>
                  <span className="text-green-700">+{checkin.points_awarded}</span>
                </div>
              </div>
              <p className="text-gray-500">
                {new Date(checkin.checked_in_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" })} · {checkin.distance_m != null ? `${Math.round(checkin.distance_m)} m` : "?"} · GPS {checkin.accuracy_m != null ? `${Math.round(checkin.accuracy_m)} m` : "?"}
              </p>
              {checkin.flag_reason && <p className="mt-1 text-orange-700">{checkin.flag_reason}</p>}
            </div>
          ))}
          {successCheckins.length === 0 && <p className="text-xs text-gray-500">Noch keine Check-ins.</p>}
        </div>
        {successCheckins.length > 5 && (
          <button
            type="button"
            onClick={() => setShowAllCheckins((v) => !v)}
            className="mt-2 text-xs font-semibold"
            style={{ color: "var(--oz-brand-green)" }}
          >
            {showAllCheckins ? "Weniger anzeigen" : `Alle ${successCheckins.length} anzeigen`}
          </button>
        )}
      </div>

      {detail.badges.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-700 mb-2">Badges</p>
          <div className="flex flex-wrap gap-1.5">
            {detail.badges.map((badge) => (
              <span key={badge.id} className="rounded-full bg-white px-2 py-1 text-xs">
                {badge.icon} {badge.title}
              </span>
            ))}
          </div>
        </div>
      )}

      {detail.audit_log.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-700 mb-2">Audit</p>
          <div className="space-y-1">
            {detail.audit_log.slice(0, 4).map((entry) => (
              <p key={entry.id} className="text-xs text-gray-600">
                {new Date(entry.created_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" })}: {entry.details ?? entry.action}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminPage() {
  const { showToast } = useToast();
  const [tab, setTab] = useState<Tab>("stats");
  const [stats, setStats] = useState<Stats | null>(null);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [challenges, setChallenges] = useState<AdminChallenge[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [flaggedCheckIns, setFlaggedCheckIns] = useState<FlaggedCheckIn[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [surveyResults, setSurveyResults] = useState<{ id: number; q1: string | null; q2: string | null; q3: string | null; q4: string | null; q5: string | null; created_at: string }[]>([]);
  const [suggestions, setSuggestions] = useState<{ id: number; user_id: number; type: string; text: string; lat: number | null; lon: number | null; image_base64: string | null; admin_reply: string | null; admin_reply_at: string | null; created_at: string; user_display_name: string }[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({});
  const [replyOpen, setReplyOpen] = useState<Record<number, boolean>>({});
  const [upcoming, setUpcoming] = useState<AdminChallenge[]>([]);
  const [editingUsers, setEditingUsers] = useState<Record<number, AdminUser>>({});
  const [userDetails, setUserDetails] = useState<Record<number, UserDetail>>({});
  const [openUserId, setOpenUserId] = useState<number | null>(null);
  const [resetChallengeIds, setResetChallengeIds] = useState<Record<number, string>>({});
  const [editingChallengeId, setEditingChallengeId] = useState<number | null>(null);
  const [challengeDraft, setChallengeDraft] = useState<Partial<AdminChallenge>>({});
  const [challengeCheckins, setChallengeCheckins] = useState<Record<number, ChallengeCheckInEntry[]>>({});
  const [openCheckinChallengeId, setOpenCheckinChallengeId] = useState<number | null>(null);
  const [editingPlaceId, setEditingPlaceId] = useState<number | null>(null);
  const [placeDraft, setPlaceDraft] = useState<Partial<Place>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New place form
  const [newPlace, setNewPlace] = useState({
    title: "", description: "", lat: "", lon: "", radius_m: "75", category: "",
  });
  // New challenge form
  const [newChallenge, setNewChallenge] = useState({
    place_id: "", title: "", description: "", story: "", day_number: "",
    start_at: "", end_at: "", points: "20", category: "",
  });

  async function loadTab(t: Tab) {
    setLoading(true);
    setError(null);
    try {
      if (t === "stats") {
        const [loadedStats, loadedHealth, loadedSurvey] = await Promise.all([
          adminFetch<Stats>("/stats"),
          adminFetch<HealthStatus>("/health-status"),
          adminFetch<{ id: number; q1: string | null; q2: string | null; q3: string | null; q4: string | null; q5: string | null; created_at: string }[]>("/survey/results").catch(() => []),
        ]);
        setStats(loadedStats);
        setHealth(loadedHealth);
        setSurveyResults(loadedSurvey);
      }
      if (t === "users") {
        const loaded = await adminFetch<AdminUser[]>("/users");
        setUsers(loaded);
        setEditingUsers(Object.fromEntries(loaded.map((u) => [u.id, { ...u }])));
      }
      if (t === "places") setPlaces(await adminFetch("/places"));
      if (t === "challenges") {
        const [loadedChallenges, loadedPlaces] = await Promise.all([
          adminFetch<AdminChallenge[]>("/challenges"),
          adminFetch<Place[]>("/places"),
        ]);
        setChallenges(loadedChallenges);
        setPlaces(loadedPlaces);
      }
      if (t === "flags") setFlaggedCheckIns(await adminFetch("/checkins/flagged"));
      if (t === "audit") setAuditLog(await adminFetch("/audit-log"));
      if (t === "suggestions") setSuggestions(await adminFetch<typeof suggestions>("/suggestions").catch(() => []));
      if (t === "upcoming") setUpcoming(await adminFetch<AdminChallenge[]>("/challenges/upcoming"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTab(tab); }, [tab]);

  async function createPlace(e: React.FormEvent) {
    e.preventDefault();
    await adminFetch("/places", {
      method: "POST",
      body: JSON.stringify({
        ...newPlace,
        lat: Number(newPlace.lat),
        lon: Number(newPlace.lon),
        radius_m: Number(newPlace.radius_m),
      }),
    });
    setNewPlace({ title: "", description: "", lat: "", lon: "", radius_m: "75", category: "" });
    showToast("Ort angelegt.", "success");
    loadTab("places");
  }

  async function createChallenge(e: React.FormEvent) {
    e.preventDefault();
    await adminFetch("/challenges", {
      method: "POST",
      body: JSON.stringify({
        ...newChallenge,
        place_id: Number(newChallenge.place_id),
        day_number: newChallenge.day_number ? Number(newChallenge.day_number) : null,
        points: Number(newChallenge.points),
        start_at: new Date(newChallenge.start_at).toISOString(),
        end_at: new Date(newChallenge.end_at).toISOString(),
        is_active: true,
      }),
    });
    setNewChallenge({
      place_id: "", title: "", description: "", story: "", day_number: "",
      start_at: "", end_at: "", points: "20", category: "",
    });
    showToast("Challenge angelegt.", "success");
    loadTab("challenges");
  }

  function updateEditingUser(userId: number, patch: Partial<AdminUser>) {
    setEditingUsers((prev) => ({ ...prev, [userId]: { ...prev[userId], ...patch } }));
  }

  async function saveUser(userId: number) {
    const user = editingUsers[userId];
    if (!user) return;
    await adminFetch(`/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({
        email: user.email,
        display_name: user.display_name,
        points: Number(user.points),
        ...(user.manual_checkin_count != null ? { target_checkin_count: Number(user.manual_checkin_count) } : {}),
        role: user.role,
        is_blocked: user.is_blocked,
        blocked_reason: user.is_blocked ? user.blocked_reason : null,
      }),
    });
    showToast("Nutzer gespeichert.", "success");
    loadTab("users");
  }

  async function toggleBlocked(user: AdminUser) {
    await adminFetch(`/users/${user.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        is_blocked: !user.is_blocked,
        blocked_reason: !user.is_blocked
          ? (user.blocked_reason || "Dein Account wurde gesperrt. Bitte wende dich an OpenZirndorf.")
          : null,
      }),
    });
    showToast(!user.is_blocked ? "Nutzer gesperrt." : "Nutzer entsperrt.", "success");
    loadTab("users");
  }

  async function deleteUser(user: AdminUser) {
    if (!window.confirm(`${user.display_name} wirklich löschen? Check-ins und Badges werden ebenfalls entfernt.`)) return;
    await adminFetch(`/users/${user.id}`, { method: "DELETE" });
    showToast("Nutzer gelöscht.", "success");
    loadTab("users");
  }

  async function resetCheckIns(user: AdminUser) {
    const challengeId = resetChallengeIds[user.id]?.trim();
    const scope = challengeId ? `Challenge #${challengeId}` : "alle Check-ins";
    if (!window.confirm(`${scope} von ${user.display_name} wirklich zurücksetzen? Punkte und Badges werden neu berechnet.`)) return;
    await adminFetch(`/users/${user.id}/reset-checkins`, {
      method: "POST",
      body: JSON.stringify({
        challenge_id: challengeId ? Number(challengeId) : null,
      }),
    });
    setResetChallengeIds((prev) => ({ ...prev, [user.id]: "" }));
    showToast("Check-ins zurückgesetzt.", "success");
    loadTab("users");
  }

  function startEditPlace(p: Place) {
    setEditingPlaceId(p.id);
    setPlaceDraft({ ...p });
  }

  async function savePlace() {
    if (!editingPlaceId) return;
    await adminFetch(`/places/${editingPlaceId}`, { method: "PATCH", body: JSON.stringify(placeDraft) });
    showToast("Ort gespeichert.", "success");
    setEditingPlaceId(null);
    loadTab("places");
  }

  function startEditChallenge(c: AdminChallenge) {
    setEditingChallengeId(c.id);
    setChallengeDraft({ ...c });
  }

  async function saveChallenge() {
    if (!editingChallengeId) return;
    const body: Record<string, unknown> = { ...challengeDraft };
    if (body.start_at) body.start_at = new Date(body.start_at as string).toISOString();
    if (body.end_at) body.end_at = new Date(body.end_at as string).toISOString();
    if (body.day_number !== undefined) body.day_number = body.day_number ? Number(body.day_number) : null;
    if (body.points !== undefined) body.points = Number(body.points);
    await adminFetch(`/challenges/${editingChallengeId}`, { method: "PATCH", body: JSON.stringify(body) });
    showToast("Challenge gespeichert.", "success");
    setEditingChallengeId(null);
    loadTab("challenges");
  }

  async function dismissCheckIn(checkin: FlaggedCheckIn) {
    await adminFetch(`/checkins/${checkin.id}/review`, {
      method: "PATCH",
      body: JSON.stringify({ is_flagged: false, flag_reason: null, approve: false }),
    });
    showToast("Prüfeintrag entfernt.", "success");
    loadTab("flags");
  }

  async function reviewCheckIn(checkin: FlaggedCheckIn, flagged: boolean) {
    await adminFetch(`/checkins/${checkin.id}/review`, {
      method: "PATCH",
      body: JSON.stringify({
        is_flagged: flagged,
        flag_reason: flagged ? (checkin.flag_reason || "Manuell markiert") : null,
      }),
    });
    showToast(flagged ? "Check-in markiert." : "Check-in freigegeben.", "success");
    loadTab("flags");
  }

  async function sendReply(suggestionId: number) {
    const reply = replyDrafts[suggestionId]?.trim();
    if (!reply) return;
    await adminFetch(`/suggestions/${suggestionId}/reply`, {
      method: "POST",
      body: JSON.stringify({ reply }),
    });
    showToast("Antwort gesendet.", "success");
    setReplyOpen((prev) => ({ ...prev, [suggestionId]: false }));
    setReplyDrafts((prev) => ({ ...prev, [suggestionId]: "" }));
    loadTab("suggestions");
  }

  async function downloadExport() {
    const raw = localStorage.getItem("auth");
    const token = raw ? (JSON.parse(raw) as { token: string }).token : null;
    const base = `${(import.meta as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL ?? ""}/api`;
    const res = await fetch(`${base}/admin/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) { showToast("Export fehlgeschlagen.", "error"); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `erfahre-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function toggleUserDetail(userId: number) {
    if (openUserId === userId) {
      setOpenUserId(null);
      return;
    }
    setOpenUserId(userId);
    if (userDetails[userId]) return;
    try {
      const detail = await adminFetch<UserDetail>(`/users/${userId}`);
      setUserDetails((prev) => ({ ...prev, [userId]: detail }));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Nutzer-Details konnten nicht geladen werden.", "error");
    }
  }

  async function toggleChallengeCheckins(challengeId: number) {
    if (openCheckinChallengeId === challengeId) {
      setOpenCheckinChallengeId(null);
      return;
    }
    setOpenCheckinChallengeId(challengeId);
    if (challengeCheckins[challengeId]) return;
    try {
      const data = await adminFetch<ChallengeCheckInEntry[]>(`/challenges/${challengeId}/checkins`);
      setChallengeCheckins((prev) => ({ ...prev, [challengeId]: data }));
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Check-ins konnten nicht geladen werden.", "error");
    }
  }

  const inputCls = "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";
  const labelCls = "block text-xs font-semibold text-gray-600 mb-1";

  return (
    <div className="max-w-[480px] mx-auto pb-24 px-4 pt-6">
      <h1
        className="text-xl font-black mb-1 flex items-center gap-2"
        style={{ fontFamily: "var(--oz-font-heading)" }}
      >
        <Shield className="w-5 h-5" style={{ color: "var(--oz-brand-green)" }} />
        Admin
      </h1>
      <p className="text-xs text-gray-400 mb-4">Erfahre Zirndorf – Verwaltung · deploy-test-ok</p>

      {/* Tabs */}
      <div className="grid grid-cols-3 rounded-xl bg-gray-100 p-1 mb-6 gap-1">
        {(["stats", "users", "flags", "audit", "places", "challenges", "suggestions", "upcoming"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-lg py-2 text-xs font-semibold transition-all ${
              tab === t ? "bg-white shadow text-gray-900" : "text-gray-500"
            }`}
          >
            {t === "stats" ? "Übersicht" : t === "users" ? "Nutzer" : t === "flags" ? "Prüfung" : t === "audit" ? "Audit" : t === "places" ? "Orte" : t === "challenges" ? "Challenges" : t === "suggestions" ? (
              <span className="relative">
                Kontakt
                {stats && stats.unanswered_support > 0 && (
                  <span className="absolute -top-1.5 -right-3 bg-blue-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">{stats.unanswered_support}</span>
                )}
              </span>
            ) : "Vorschau"}
          </button>
        ))}
      </div>

      {error && <div className="rounded-xl p-3 bg-red-50 text-red-700 text-sm mb-4">{error}</div>}

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="bg-white rounded-2xl h-20 animate-pulse" />)}
        </div>
      ) : (
        <>
          {tab === "stats" && stats && (
            <div className="space-y-4">
              {health && (
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <HeartPulse className="w-4 h-4" style={{ color: "var(--oz-brand-green)" }} />
                    <h2 className="text-sm font-bold">Systemstatus</h2>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-green-50 p-3 text-green-800">API: {health.api}</div>
                    <div className="rounded-xl bg-green-50 p-3 text-green-800">DB: {health.database}</div>
                    <div className="rounded-xl bg-gray-50 p-3 text-gray-700">
                      Aktion: {health.event_status === "active" ? "aktiv" : health.event_status === "upcoming" ? "geplant" : "beendet"}
                    </div>
                    <div className="rounded-xl bg-gray-50 p-3 text-gray-700">Aktive Challenges: {health.active_challenges}</div>
                    <div className="col-span-2 rounded-xl bg-gray-50 p-3 text-gray-700">
                      Letzter Check-in: {health.last_checkin_at ? new Date(health.last_checkin_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }) : "noch keiner"}
                    </div>
                  </div>
                </div>
              )}

              {/* Tagesaktivität */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-sm font-bold mb-3">Tagesaktivität</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-gray-50 p-3 text-center">
                    <p className="text-2xl font-black" style={{ fontFamily: "var(--oz-font-heading)" }}>{stats.checkins_today}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Check-ins heute</p>
                  </div>
                  <div className="rounded-xl bg-gray-50 p-3 text-center">
                    <p className="text-2xl font-black text-gray-400" style={{ fontFamily: "var(--oz-font-heading)" }}>{stats.checkins_yesterday}</p>
                    <p className="text-xs text-gray-500 mt-0.5">gestern</p>
                  </div>
                </div>
                <div className="mt-3 rounded-xl p-3 text-center" style={{ background: "var(--oz-brand-green-light)" }}>
                  <p className="text-2xl font-black" style={{ fontFamily: "var(--oz-font-heading)", color: "var(--oz-brand-green)" }}>{stats.total_points.toLocaleString("de-DE")}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--oz-brand-green)" }}>Punkte insgesamt gesammelt</p>
                </div>
                {stats.unanswered_support > 0 && (
                  <button
                    type="button"
                    onClick={() => setTab("suggestions")}
                    className="mt-3 w-full rounded-xl p-3 text-sm font-bold text-left flex items-center justify-between bg-blue-50 text-blue-700"
                  >
                    <span>{stats.unanswered_support} unbeantwortete Support-Anfrage{stats.unanswered_support !== 1 ? "n" : ""}</span>
                    <span>→</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Nutzer", value: stats.users },
                  { label: "Check-ins", value: stats.successful_checkins },
                  { label: "Markiert", value: stats.flagged_checkins },
                  { label: "Challenges", value: stats.challenges },
                ].map((s) => (
                  <div key={s.label} className="bg-white rounded-2xl p-4 text-center shadow-sm">
                    <p className="text-3xl font-black" style={{ fontFamily: "var(--oz-font-heading)" }}>
                      {s.value}
                    </p>
                    <p className="text-xs text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>

              {surveyResults.length > 0 && (
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                  <p className="text-sm font-bold mb-3">Umfrage ({surveyResults.length} Antworten)</p>
                  {(["q1", "q2", "q3", "q4"] as const).map((key) => {
                    const labels: Record<string, string> = {
                      q1: "Wo hast du von der App erfahren?",
                      q2: "Warum machst du mit?",
                      q3: "Teams interessant?",
                      q4: "Quize und Aufgaben interessant?",
                    };
                    const counts: Record<string, number> = {};
                    surveyResults.forEach((r) => { if (r[key]) counts[r[key]!] = (counts[r[key]!] ?? 0) + 1; });
                    const total = Object.values(counts).reduce((s, n) => s + n, 0);
                    return total === 0 ? null : (
                      <div key={key} className="mb-3">
                        <p className="text-xs font-semibold text-gray-600 mb-1">{labels[key]}</p>
                        <div className="space-y-1">
                          {Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([label, n]) => (
                            <div key={label} className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{ width: `${Math.round((n / total) * 100)}%`, background: "var(--oz-brand-green)" }}
                                />
                              </div>
                              <span className="text-xs text-gray-600 w-4 text-right">{n}</span>
                              <span className="text-xs text-gray-500 min-w-0 truncate max-w-[120px]">{label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {surveyResults.some((r) => r.q5) && (
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-1">Wünsche</p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {surveyResults.filter((r) => r.q5).map((r) => (
                          <p key={r.id} className="text-xs text-gray-700 bg-gray-50 rounded-lg px-2 py-1">"{r.q5}"</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={downloadExport}
                className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-bold bg-white shadow-sm text-gray-700 hover:bg-gray-50"
              >
                <ClipboardList className="w-4 h-4" />
                DB-Export herunterladen
              </button>
            </div>
          )}

          {tab === "flags" && (
            <div className="space-y-3">
              {flaggedCheckIns.length === 0 && (
                <div className="rounded-2xl bg-white p-5 text-center text-sm text-gray-500 shadow-sm">
                  Keine markierten Check-ins.
                </div>
              )}
              {flaggedCheckIns.map((checkin) => (
                <div key={checkin.id} className="rounded-2xl bg-white p-4 shadow-sm border border-orange-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">{checkin.user_display_name}</p>
                      <p className="text-xs text-gray-500 truncate">{checkin.challenge_title}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${checkin.success ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                      {checkin.success ? `${checkin.points_awarded} Punkte` : "Fehlversuch"}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500">
                    <div>Distanz: {checkin.distance_m ?? "?"} m</div>
                    <div>Genauigkeit: {checkin.accuracy_m ?? "?"} m</div>
                    <div className="col-span-2">{new Date(checkin.checked_in_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}</div>
                  </div>
                  {checkin.flag_reason && (
                    <div className="mt-3 rounded-xl bg-orange-50 p-3 text-xs text-orange-800">
                      {checkin.flag_reason}
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    <button type="button" onClick={() => reviewCheckIn(checkin, false)} className="flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold bg-green-50 text-green-700">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Freigeben
                    </button>
                    <button type="button" onClick={() => reviewCheckIn(checkin, true)} className="flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold bg-orange-50 text-orange-700">
                      <Flag className="w-3.5 h-3.5" />
                      Markiert lassen
                    </button>
                    <button type="button" onClick={() => dismissCheckIn(checkin)} className="flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold bg-gray-100 text-gray-600">
                      <X className="w-3.5 h-3.5" />
                      Entfernen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "suggestions" && (
            <div className="space-y-3">
              {suggestions.length === 0 && (
                <div className="rounded-2xl bg-white p-5 text-center text-sm text-gray-500 shadow-sm">
                  Noch keine Vorschläge.
                </div>
              )}
              {suggestions.map((s) => (
                <div key={s.id} className={`rounded-2xl bg-white p-4 shadow-sm ${s.type === "support" ? "border border-blue-100" : ""}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${s.type === "support" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                          {s.type === "stop" ? "Stop" : s.type === "sponsor" ? "Sponsor" : s.type === "support" ? "Support" : "Idee"}
                        </span>
                        <span className="text-xs text-gray-400 truncate">
                          {s.user_display_name} · {new Date(s.created_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{s.text}</p>
                      {s.lat != null && s.lon != null && (
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${s.lat}&mlon=${s.lon}&zoom=17`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold mt-1 no-underline"
                          style={{ color: "var(--oz-brand-green)" }}
                        >
                          📍 {s.lat.toFixed(5)}, {s.lon.toFixed(5)} → OpenStreetMap
                        </a>
                      )}
                      {s.image_base64 && (
                        <img
                          src={s.image_base64}
                          alt="Foto"
                          className="mt-2 rounded-xl w-full object-cover"
                          style={{ maxHeight: "200px" }}
                        />
                      )}

                      {/* Bestehende Antwort */}
                      {s.admin_reply && (
                        <div className="mt-3 rounded-xl bg-green-50 p-3">
                          <p className="text-xs font-bold text-green-700 mb-1">Deine Antwort</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{s.admin_reply}</p>
                        </div>
                      )}

                      {/* Antwort-Formular */}
                      {replyOpen[s.id] ? (
                        <div className="mt-3 space-y-2">
                          <textarea
                            value={replyDrafts[s.id] ?? ""}
                            onChange={(e) => setReplyDrafts((prev) => ({ ...prev, [s.id]: e.target.value }))}
                            rows={3}
                            placeholder="Antwort schreiben…"
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => sendReply(s.id)}
                              disabled={!replyDrafts[s.id]?.trim()}
                              className="flex-1 rounded-xl py-2 text-xs font-bold text-white disabled:opacity-50"
                              style={{ background: "var(--oz-brand-green)" }}
                            >
                              Antwort senden
                            </button>
                            <button
                              type="button"
                              onClick={() => setReplyOpen((prev) => ({ ...prev, [s.id]: false }))}
                              className="rounded-xl px-3 py-2 text-xs font-bold bg-gray-100 text-gray-600"
                            >
                              Abbrechen
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setReplyOpen((prev) => ({ ...prev, [s.id]: true }));
                            if (s.admin_reply) setReplyDrafts((prev) => ({ ...prev, [s.id]: s.admin_reply! }));
                          }}
                          className="mt-2 text-xs font-semibold"
                          style={{ color: "var(--oz-brand-green)" }}
                        >
                          {s.admin_reply ? "Antwort bearbeiten" : "Antworten"}
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await adminFetch(`/suggestions/${s.id}`, { method: "DELETE" });
                        setSuggestions((prev) => prev.filter((x) => x.id !== s.id));
                      }}
                      className="shrink-0 text-xs text-red-500 hover:text-red-700 font-semibold"
                    >
                      Löschen
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "upcoming" && (
            <div className="space-y-3">
              {upcoming.length === 0 && (
                <div className="rounded-2xl bg-white p-5 text-center text-sm text-gray-500 shadow-sm">
                  Keine kommenden Challenges.
                </div>
              )}
              {upcoming.map((c) => (
                <div key={c.id} className="rounded-2xl bg-white p-4 shadow-sm flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    {c.day_number && (
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">Tag {c.day_number}</p>
                    )}
                    <p className="text-sm font-bold text-gray-900 truncate">{c.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {parseUTC(c.start_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" })} · {c.points} Pkt.
                    </p>
                  </div>
                  <a
                    href={`/#/challenge/${c.id}?preview=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 rounded-xl px-3 py-2 text-xs font-bold text-white"
                    style={{ background: "var(--oz-brand-green)" }}
                  >
                    Vorschau
                  </a>
                </div>
              ))}
            </div>
          )}

          {tab === "audit" && (
            <div className="space-y-3">
              {auditLog.length === 0 && (
                <div className="rounded-2xl bg-white p-5 text-center text-sm text-gray-500 shadow-sm">
                  Noch keine Admin-Aktionen.
                </div>
              )}
              {auditLog.map((entry) => (
                <div key={entry.id} className="rounded-2xl bg-white p-4 shadow-sm">
                  <div className="flex items-start gap-2">
                    <ClipboardList className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--oz-brand-green)" }} />
                    <div className="min-w-0">
                      <p className="text-sm font-bold">{entry.action}</p>
                      <p className="text-xs text-gray-500">
                        {entry.admin_display_name ?? "System"} · {new Date(entry.created_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })}
                      </p>
                      {entry.details && <p className="text-xs text-gray-700 mt-2">{entry.details}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "users" && (
            <div className="space-y-3">
              {users.map((user) => {
                const draft = editingUsers[user.id] ?? user;
                return (
                  <div key={user.id} className={`bg-white rounded-2xl p-4 shadow-sm border ${user.is_blocked ? "border-red-200" : "border-transparent"}`}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="min-w-0">
                        <p className="font-bold text-sm truncate">{user.display_name}</p>
                        <p className="text-xs text-gray-400 truncate">{user.email}</p>
                        {(user.referral_code || user.referred_by_display_name || (user.referrals_count ?? 0) > 0) && (
                          <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                            {user.referral_code && <span className="font-mono">{user.referral_code}</span>}
                            {user.referred_by_display_name && (
                              <span> · Geworben von <span className="font-semibold text-gray-600">{user.referred_by_display_name}</span></span>
                            )}
                            {(user.referrals_count ?? 0) > 0 && (
                              <span> · {user.referrals_count} Einladung{user.referrals_count !== 1 ? "en" : ""}</span>
                            )}
                          </p>
                        )}
                      </div>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0 ${user.is_blocked ? "bg-red-100 text-red-700" : user.role === "admin" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                      >
                        {user.is_blocked ? "gesperrt" : user.role === "admin" ? "Admin" : "Teilnehmer"}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <label className={labelCls}>Anzeigename</label>
                        <input className={inputCls} value={draft.display_name} onChange={(e) => updateEditingUser(user.id, { display_name: e.target.value })} />
                      </div>
                      <div>
                        <label className={labelCls}>E-Mail</label>
                        <input type="email" className={inputCls} value={draft.email} onChange={(e) => updateEditingUser(user.id, { email: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className={labelCls}>Punkte</label>
                          <input type="number" className={inputCls} value={draft.points} onChange={(e) => updateEditingUser(user.id, { points: Number(e.target.value) })} />
                        </div>
                        <div>
                          <label className={labelCls}>Stops setzen auf (aktuell: {user.checkin_count + user.manual_checkin_count})</label>
                          <input type="number" min="0" className={inputCls} placeholder={String(user.checkin_count + user.manual_checkin_count)} onChange={(e) => updateEditingUser(user.id, { manual_checkin_count: Number(e.target.value) })} />
                        </div>
                        <div>
                          <label className={labelCls}>Rolle</label>
                          <select className={`${inputCls} bg-white`} value={draft.role} onChange={(e) => updateEditingUser(user.id, { role: e.target.value as AdminUser["role"] })}>
                            <option value="participant">Teilnehmer</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className={labelCls}>Sperrgrund</label>
                        <select
                          className={`${inputCls} bg-white mb-2`}
                          value=""
                          onChange={(e) => updateEditingUser(user.id, { blocked_reason: e.target.value })}
                        >
                          <option value="">Grund wählen …</option>
                          {BLOCK_REASON_OPTIONS.map((reason) => (
                            <option key={reason.label} value={reason.value}>{reason.label}</option>
                          ))}
                        </select>
                        <label className={labelCls}>Sperrhinweis / Notiz</label>
                        <textarea
                          className={`${inputCls} h-16 resize-none`}
                          value={draft.blocked_reason ?? ""}
                          onChange={(e) => updateEditingUser(user.id, { blocked_reason: e.target.value })}
                          placeholder="Dein Account wurde gesperrt. Bitte wende dich an OpenZirndorf."
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <button type="button" onClick={() => saveUser(user.id)} className="flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold text-white" style={{ background: "var(--oz-brand-green)" }}>
                        <Save className="w-3.5 h-3.5" />
                        Speichern
                      </button>
                      <button type="button" onClick={() => toggleBlocked(draft)} className={`flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold ${draft.is_blocked ? "bg-gray-100 text-gray-700" : "bg-red-50 text-red-700"}`}>
                        {draft.is_blocked ? <Unlock className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                        {draft.is_blocked ? "Entsperren" : "Sperren"}
                      </button>
                      <button type="button" onClick={() => deleteUser(user)} className="flex items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold bg-red-600 text-white">
                        <Trash2 className="w-3.5 h-3.5" />
                        Löschen
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleUserDetail(user.id)}
                      className="mt-3 flex w-full items-center justify-center gap-1 rounded-xl py-2 text-xs font-bold bg-green-50"
                      style={{ color: "var(--oz-brand-green)" }}
                    >
                      <Info className="w-3.5 h-3.5" />
                      {openUserId === user.id ? "Details ausblenden" : "Details anzeigen"}
                    </button>

                    {openUserId === user.id && (
                      <UserDetailPanel detail={userDetails[user.id]} />
                    )}

                    <div className="mt-3 rounded-xl bg-gray-50 p-3">
                      <label className={labelCls}>Check-ins zurücksetzen</label>
                      <div className="grid grid-cols-[1fr_auto] gap-2">
                        <input
                          type="number"
                          className={inputCls}
                          value={resetChallengeIds[user.id] ?? ""}
                          onChange={(e) => setResetChallengeIds((prev) => ({ ...prev, [user.id]: e.target.value }))}
                          placeholder="Challenge-ID leer = alle"
                        />
                        <button
                          type="button"
                          onClick={() => resetCheckIns(user)}
                          className="flex items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-bold bg-orange-50 text-orange-700"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Reset
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === "places" && (
            <div className="space-y-4">
              {/* Place list */}
              <div className="space-y-2">
                {places.map((p) => (
                  <div key={p.id} className={`bg-white rounded-xl shadow-sm border-l-4 ${editingPlaceId === p.id ? "border-green-500" : "border-transparent"}`}>
                    <div className="flex items-center justify-between gap-2 p-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{p.title}</p>
                        <p className="text-xs text-gray-400">
                          {p.lat.toFixed(5)}, {p.lon.toFixed(5)} · {p.radius_m} m
                          {p.category && ` · ${p.category}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => editingPlaceId === p.id ? setEditingPlaceId(null) : startEditPlace(p)}
                        className="shrink-0 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"
                      >
                        {editingPlaceId === p.id ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                      </button>
                    </div>

                    {editingPlaceId === p.id && (
                      <div className="px-3 pb-3 space-y-2 border-t border-gray-100 pt-3">
                        <div><label className={labelCls}>Titel</label>
                          <input className={inputCls} value={placeDraft.title ?? ""} onChange={(e) => setPlaceDraft((d) => ({ ...d, title: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div><label className={labelCls}>Breitengrad</label>
                            <input type="number" step="any" className={inputCls} value={placeDraft.lat ?? ""} onChange={(e) => setPlaceDraft((d) => ({ ...d, lat: Number(e.target.value) }))} />
                          </div>
                          <div><label className={labelCls}>Längengrad</label>
                            <input type="number" step="any" className={inputCls} value={placeDraft.lon ?? ""} onChange={(e) => setPlaceDraft((d) => ({ ...d, lon: Number(e.target.value) }))} />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div><label className={labelCls}>Radius (m)</label>
                            <input type="number" step="1" min="5" className={inputCls} value={placeDraft.radius_m ?? ""} onChange={(e) => setPlaceDraft((d) => ({ ...d, radius_m: Number(e.target.value) }))} />
                          </div>
                          <div><label className={labelCls}>Kategorie</label>
                            <input className={inputCls} value={placeDraft.category ?? ""} onChange={(e) => setPlaceDraft((d) => ({ ...d, category: e.target.value || null }))} placeholder="natur, kultur …" />
                          </div>
                        </div>
                        <button type="button" onClick={savePlace} className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold text-white" style={{ background: "var(--oz-brand-green)" }}>
                          <Save className="w-4 h-4" />
                          Speichern
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add place form */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-1.5">
                  <Plus className="w-4 h-4" style={{ color: "var(--oz-brand-green)" }} />
                  Neuer Ort
                </h3>
                <form onSubmit={createPlace} className="space-y-2">
                  <div><label className={labelCls}>Titel</label><input required className={inputCls} value={newPlace.title} onChange={(e) => setNewPlace({ ...newPlace, title: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={labelCls}>Breitengrad</label><input required type="number" step="any" className={inputCls} value={newPlace.lat} onChange={(e) => setNewPlace({ ...newPlace, lat: e.target.value })} placeholder="49.4443" /></div>
                    <div><label className={labelCls}>Längengrad</label><input required type="number" step="any" className={inputCls} value={newPlace.lon} onChange={(e) => setNewPlace({ ...newPlace, lon: e.target.value })} placeholder="10.9556" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={labelCls}>Radius (m)</label><input type="number" className={inputCls} value={newPlace.radius_m} onChange={(e) => setNewPlace({ ...newPlace, radius_m: e.target.value })} /></div>
                    <div><label className={labelCls}>Kategorie</label><input className={inputCls} value={newPlace.category} onChange={(e) => setNewPlace({ ...newPlace, category: e.target.value })} placeholder="natur, kultur …" /></div>
                  </div>
                  <div><label className={labelCls}>Beschreibung</label><textarea className={`${inputCls} h-20 resize-none`} value={newPlace.description} onChange={(e) => setNewPlace({ ...newPlace, description: e.target.value })} /></div>
                  <button type="submit" className="w-full rounded-xl py-2.5 text-sm font-bold text-white" style={{ background: "var(--oz-brand-green)" }}>Ort anlegen</button>
                </form>
              </div>
            </div>
          )}

          {tab === "challenges" && (
            <div className="space-y-4">
              <div className="space-y-2">
                {challenges.map((c) => (
                  <div key={c.id} className={`bg-white rounded-xl shadow-sm border-l-4 ${c.is_active ? "border-green-500" : "border-gray-200"}`}>
                    <div className="flex items-center justify-between gap-2 p-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{c.title}</p>
                        <p className="text-xs text-gray-400">
                          {c.day_number ? `Tag ${c.day_number} · ` : "Sofort · "}{parseUTC(c.start_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" })} · {c.points} Pkt
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => toggleChallengeCheckins(c.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"
                          title="Check-ins anzeigen"
                        >
                          <ClipboardList className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => editingChallengeId === c.id ? setEditingChallengeId(null) : startEditChallenge(c)}
                          className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"
                        >
                          {editingChallengeId === c.id ? <X className="w-4 h-4" /> : <Pencil className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {openCheckinChallengeId === c.id && (
                      <div className="px-3 pb-3 border-t border-gray-100 pt-3">
                        <p className="text-xs font-bold text-gray-700 mb-2">
                          Check-ins ({challengeCheckins[c.id]?.length ?? "…"})
                        </p>
                        {!challengeCheckins[c.id] ? (
                          <p className="text-xs text-gray-400">Wird geladen …</p>
                        ) : challengeCheckins[c.id].length === 0 ? (
                          <p className="text-xs text-gray-400">Noch keine Check-ins.</p>
                        ) : (
                          <div className="space-y-1.5 max-h-64 overflow-y-auto">
                            {challengeCheckins[c.id].map((ci) => (
                              <div key={ci.id} className={`rounded-lg p-2 text-xs flex items-center justify-between gap-2 ${ci.is_flagged ? "bg-orange-50" : "bg-gray-50"}`}>
                                <div className="min-w-0">
                                  <span className="font-semibold text-gray-800">{ci.user_display_name}</span>
                                  <span className="text-gray-400 ml-2">
                                    {new Date(ci.checked_in_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "short" })}
                                  </span>
                                  {ci.is_flagged && <span className="ml-1 text-orange-600">⚑</span>}
                                </div>
                                <span className="shrink-0 text-gray-500">{ci.distance_m != null ? `${Math.round(ci.distance_m)} m` : "?"}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {editingChallengeId === c.id && (
                      <div className="px-3 pb-3 space-y-2 border-t border-gray-100 pt-3">
                        <div><label className={labelCls}>Titel</label>
                          <input className={inputCls} value={challengeDraft.title ?? ""} onChange={(e) => setChallengeDraft((d) => ({ ...d, title: e.target.value }))} />
                        </div>
                        <div><label className={labelCls}>Beschreibung</label>
                          <textarea className={`${inputCls} h-16 resize-none`} value={(challengeDraft as { description?: string }).description ?? ""} onChange={(e) => setChallengeDraft((d) => ({ ...d, description: e.target.value }))} />
                        </div>
                        <div><label className={labelCls}>Story</label>
                          <textarea className={`${inputCls} h-24 resize-none`} value={(challengeDraft as { story?: string }).story ?? ""} onChange={(e) => setChallengeDraft((d) => ({ ...d, story: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div><label className={labelCls}>Punkte</label>
                            <input type="number" className={inputCls} value={challengeDraft.points ?? ""} onChange={(e) => setChallengeDraft((d) => ({ ...d, points: Number(e.target.value) }))} />
                          </div>
                          <div><label className={labelCls}>Tag</label>
                            <input type="number" className={inputCls} value={challengeDraft.day_number ?? ""} onChange={(e) => setChallengeDraft((d) => ({ ...d, day_number: e.target.value ? Number(e.target.value) : null }))} placeholder="leer = sofort" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div><label className={labelCls}>Start</label>
                            <input type="datetime-local" className={inputCls} value={challengeDraft.start_at ? toBerlinInput(challengeDraft.start_at) : ""} onChange={(e) => setChallengeDraft((d) => ({ ...d, start_at: e.target.value }))} />
                          </div>
                          <div><label className={labelCls}>Ende</label>
                            <input type="datetime-local" className={inputCls} value={challengeDraft.end_at ? toBerlinInput(challengeDraft.end_at) : ""} onChange={(e) => setChallengeDraft((d) => ({ ...d, end_at: e.target.value }))} />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input type="checkbox" id={`active-${c.id}`} checked={challengeDraft.is_active ?? true} onChange={(e) => setChallengeDraft((d) => ({ ...d, is_active: e.target.checked }))} className="rounded" />
                          <label htmlFor={`active-${c.id}`} className="text-xs font-semibold text-gray-600">Aktiv</label>
                        </div>
                        <button type="button" onClick={saveChallenge} className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-bold text-white" style={{ background: "var(--oz-brand-green)" }}>
                          <Save className="w-4 h-4" />
                          Speichern
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Add challenge form */}
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-1.5">
                  <Plus className="w-4 h-4" style={{ color: "var(--oz-brand-green)" }} />
                  Neue Challenge
                </h3>
                <form onSubmit={createChallenge} className="space-y-2">
                  <div>
                    <label className={labelCls}>Ort</label>
                    <select required className={`${inputCls} bg-white`} value={newChallenge.place_id} onChange={(e) => setNewChallenge({ ...newChallenge, place_id: e.target.value })}>
                      <option value="">Ort wählen …</option>
                      {places.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={labelCls}>Tag (1–21)</label><input type="number" min="1" max="21" className={inputCls} value={newChallenge.day_number} onChange={(e) => setNewChallenge({ ...newChallenge, day_number: e.target.value })} /></div>
                    <div><label className={labelCls}>Punkte</label><input type="number" className={inputCls} value={newChallenge.points} onChange={(e) => setNewChallenge({ ...newChallenge, points: e.target.value })} /></div>
                  </div>
                  <div><label className={labelCls}>Titel</label><input required className={inputCls} value={newChallenge.title} onChange={(e) => setNewChallenge({ ...newChallenge, title: e.target.value })} /></div>
                  <div><label className={labelCls}>Beschreibung</label><textarea required className={`${inputCls} h-16 resize-none`} value={newChallenge.description} onChange={(e) => setNewChallenge({ ...newChallenge, description: e.target.value })} /></div>
                  <div><label className={labelCls}>Story (optional)</label><textarea className={`${inputCls} h-20 resize-none`} value={newChallenge.story} onChange={(e) => setNewChallenge({ ...newChallenge, story: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={labelCls}>Start (Berliner Zeit)</label><input type="datetime-local" required className={inputCls} value={newChallenge.start_at} onChange={(e) => setNewChallenge({ ...newChallenge, start_at: e.target.value })} /></div>
                    <div><label className={labelCls}>Ende (Berliner Zeit)</label><input type="datetime-local" required className={inputCls} value={newChallenge.end_at} onChange={(e) => setNewChallenge({ ...newChallenge, end_at: e.target.value })} /></div>
                  </div>
                  <button type="submit" className="w-full rounded-xl py-2.5 text-sm font-bold text-white" style={{ background: "var(--oz-brand-green)" }}>Challenge anlegen</button>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
