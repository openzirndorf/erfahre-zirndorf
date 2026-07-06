import { Camera, CheckCircle2, ClipboardList, Clock, HelpCircle, Lock, MapPin, Star, Trophy, Zap } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";
import { cn } from "../lib/utils";
import { BONUS_FIRST_CHECKIN, BONUS_FIRST_DAY, type Challenge, calcMaxPoints } from "../types";

const CATEGORY_COLORS: Record<string, string> = {
  natur:      "bg-green-100 text-green-800",
  mobilitaet: "bg-blue-100 text-blue-800",
  kultur:     "bg-purple-100 text-purple-800",
  verein:     "bg-orange-100 text-orange-800",
  familie:    "bg-pink-100 text-pink-800",
  verwaltung: "bg-gray-100 text-gray-800",
};

function isTodayActive(c: Challenge) {
  const now = new Date();
  return c.is_active && new Date(c.start_at) <= now && now <= new Date(c.end_at);
}
function isFuture(c: Challenge) { return !c.is_active; }

/** Kleine Punkte-Badge: zeigt Basis + Boni */
function PointsBadge({ challenge, compact = false }: { challenge: Challenge; compact?: boolean }) {
  const isFirst    = challenge.checkin_count === 0;
  const isFirstDay = challenge.first_day_active;
  const maxPts     = calcMaxPoints(challenge);
  const hasBonus   = isFirst || isFirstDay;

  if (compact) {
    return (
      <div className="flex items-center gap-0.5 shrink-0">
        <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
        <span className="text-sm font-black" style={{ fontFamily: "var(--oz-font-heading)" }}>
          {hasBonus ? `bis ${maxPts}` : challenge.points}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-0.5 shrink-0">
      <div className="flex items-center gap-0.5">
        <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
        <span className="text-sm font-black" style={{ fontFamily: "var(--oz-font-heading)" }}>
          {hasBonus ? `bis ${maxPts}` : challenge.points}
        </span>
      </div>
      {isFirst && (
        <span className="text-[10px] font-bold text-orange-500 flex items-center gap-0.5 leading-none">
          <Trophy className="w-2.5 h-2.5" />Erster: +{BONUS_FIRST_CHECKIN}
        </span>
      )}
      {isFirstDay && (
        <span className="text-[10px] font-bold text-blue-500 flex items-center gap-0.5 leading-none">
          <Zap className="w-2.5 h-2.5" />Früh: +{BONUS_FIRST_DAY}
        </span>
      )}
    </div>
  );
}

export { PointsBadge };

interface Props { challenge: Challenge }

export function ChallengeCard({ challenge }: Props) {
  const categoryColor = challenge.category
    ? (CATEGORY_COLORS[challenge.category] ?? "bg-gray-100 text-gray-700")
    : "";
  const activeToday = isTodayActive(challenge);
  const done        = challenge.user_checked_in ?? false;
  const future      = isFuture(challenge) && !done;

  if (future) {
    return (
      <div className="rounded-2xl overflow-hidden border border-dashed border-gray-200 bg-gray-50">
        <div className="h-1.5 bg-gray-200" />
        <div className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-200 flex items-center justify-center shrink-0">
            <Lock className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0">
            {challenge.day_number && (
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-0.5">
                Tag {challenge.day_number}
              </p>
            )}
            <p className="text-sm font-semibold text-gray-400">Noch nicht verfügbar</p>
          </div>
          {challenge.category && (
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium opacity-50", categoryColor)}>
              {challenge.category}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <Link to={`/challenge/${challenge.id}`} className="block no-underline">
      <div
        className={cn(
          "rounded-2xl overflow-hidden transition-all duration-200 active:scale-[0.98]",
          "border hover:shadow-md bg-white",
          done
            ? "border-green-200 ring-2 ring-green-500 ring-offset-1"
            : activeToday
              ? "border-[--oz-brand-green] shadow-[0_0_0_1px_var(--oz-brand-green)]"
              : "border-gray-100 hover:border-gray-200",
        )}
        style={{ boxShadow: activeToday && !done ? "0 4px 16px rgba(0,154,0,0.12)" : "var(--oz-shadow)" }}
      >
        <div
          className="h-1.5"
          style={{
            background: done
              ? "var(--oz-brand-green)"
              : activeToday
                ? "linear-gradient(90deg, var(--oz-brand-green), #7ecf00)"
                : "#e5e7eb",
          }}
        />

        <div className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                {challenge.day_number && (
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">
                    Tag {challenge.day_number}
                  </span>
                )}
                {activeToday && !done && (
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5"
                    style={{ background: "var(--oz-brand-green)", color: "white" }}
                  >
                    <Zap className="w-2.5 h-2.5" />HEUTE
                  </span>
                )}
                {challenge.is_mystery && !done && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 bg-purple-100 text-purple-700">
                    <HelpCircle className="w-2.5 h-2.5" />MYSTERY
                  </span>
                )}
                {challenge.is_task && !challenge.is_photo && !done && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 bg-red-100 text-red-700">
                    <ClipboardList className="w-2.5 h-2.5" />AUFGABE
                  </span>
                )}
                {challenge.is_photo && !done && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 bg-gray-900 text-white">
                    <Camera className="w-2.5 h-2.5" />FOTO
                  </span>
                )}
                {challenge.is_photo && done && challenge.photo_submission_status === "pending" && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 bg-yellow-100 text-yellow-700">
                    <Clock className="w-2.5 h-2.5" />AUSSTEHEND
                  </span>
                )}
                {challenge.is_photo && done && challenge.photo_submission_status === "rejected" && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 bg-red-100 text-red-700">
                    <Camera className="w-2.5 h-2.5" />NEU EINREICHEN
                  </span>
                )}
              </div>
              <h3
                className="font-bold text-gray-900 text-base leading-snug truncate"
                style={{ fontFamily: "var(--oz-font-heading)" }}
              >
                {challenge.title}
              </h3>
            </div>

            {done ? (
              <CheckCircle2 className="w-6 h-6 shrink-0" style={{ color: "var(--oz-brand-green)" }} />
            ) : (
              <PointsBadge challenge={challenge} />
            )}
          </div>

          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{challenge.description}</p>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <MapPin className="w-3.5 h-3.5" />
              <span className="truncate max-w-[160px]">
                {challenge.is_mystery && !done ? "Mystery Ort" : challenge.place.title}
              </span>
            </div>
            {challenge.category && (
              <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", categoryColor)}>
                {challenge.category}
              </span>
            )}
          </div>

          {done && (!challenge.is_photo || challenge.photo_submission_status === "approved") && (
            <div
              className="mt-3 text-xs font-semibold flex items-center gap-1 rounded-full px-3 py-1 w-fit"
              style={{ background: "var(--oz-brand-green-light)", color: "var(--oz-brand-green)" }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />Erledigt
            </div>
          )}
          {done && challenge.is_photo && challenge.photo_submission_status === "pending" && (
            <div className="mt-3 text-xs font-semibold flex items-center gap-1 rounded-full px-3 py-1 w-fit bg-yellow-50 text-yellow-700">
              <Clock className="w-3.5 h-3.5" />Foto in Prüfung
            </div>
          )}
          {done && challenge.is_photo && challenge.photo_submission_status === "rejected" && (
            <div className="mt-3 text-xs font-semibold flex items-center gap-1 rounded-full px-3 py-1 w-fit bg-red-50 text-red-700">
              <Camera className="w-3.5 h-3.5" />Foto abgelehnt
            </div>
          )}
          {done && challenge.is_photo && !challenge.photo_submission_status && (
            <div className="mt-3 text-xs font-semibold flex items-center gap-1 rounded-full px-3 py-1 w-fit bg-gray-100 text-gray-600">
              <Camera className="w-3.5 h-3.5" />Foto hochladen
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
