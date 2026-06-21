import { CheckCircle2, Star, X, Zap } from "lucide-react";
import React from "react";
import type { CheckInResponse } from "../types";
import { ShareButton } from "./share-button";

interface Props {
  response: CheckInResponse;
  challengeTitle?: string;
  onClose: () => void;
}

export function SuccessModal({ response, challengeTitle, onClose }: Props) {
  const basePoints = response.points_awarded - response.bonuses.reduce((s, b) => s + b.points, 0);
  const shareText = challengeTitle
    ? `Ich habe gerade „${challengeTitle}" bei Erfahre Zirndorf abgeschlossen! 🚴 +${response.points_awarded} Punkte`
    : `Ich habe gerade eine Challenge bei Erfahre Zirndorf abgeschlossen! 🚴 +${response.points_awarded} Punkte`;

  return (
    <div className="oz-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div
        className="oz-success-sheet relative w-full max-w-sm bg-white rounded-3xl p-6 pb-8 text-center"
        style={{ boxShadow: "var(--oz-shadow-lg)" }}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:bg-gray-100"
          aria-label="Schließen"
        >
          <X className="w-5 h-5" />
        </button>

        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: "var(--oz-brand-green-light)" }}
        >
          <CheckCircle2 className="w-8 h-8" style={{ color: "var(--oz-brand-green)" }} />
        </div>

        <h2
          className="text-xl font-black mb-3"
          style={{ fontFamily: "var(--oz-font-heading)", color: "var(--oz-brand-green)" }}
        >
          Check-in erfolgreich!
        </h2>

        {/* Punkte-Übersicht */}
        <div className="mb-4 space-y-1.5">
          <div className="flex items-center justify-center gap-1.5">
            <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
            <span className="text-2xl font-black text-gray-900">+{basePoints}</span>
            <span className="text-gray-500 text-sm">Punkte</span>
          </div>

          {response.bonuses.map((bonus) => (
            <div
              key={bonus.reason}
              className="flex items-center justify-center gap-1.5 text-sm font-semibold"
              style={{ color: "var(--oz-brand-orange, #f97316)" }}
            >
              <Zap className="w-4 h-4" />
              {bonus.reason}
            </div>
          ))}

          {response.bonuses.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-center gap-1.5">
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
              <span className="font-black text-gray-900">= {response.points_awarded} Punkte gesamt</span>
            </div>
          )}
        </div>

        {response.badges_unlocked.length > 0 && (
          <div className="mb-4">
            <p className="text-sm font-semibold text-gray-700 mb-2">Neue Badges!</p>
            <div className="flex flex-wrap justify-center gap-2">
              {response.badges_unlocked.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium"
                  style={{ background: "var(--oz-brand-green-light)", color: "var(--oz-brand-green)" }}
                >
                  <span>{b.icon}</span>
                  {b.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {response.is_flagged && (
          <div className="mb-4 rounded-xl bg-orange-50 p-3 text-sm text-orange-800">
            Dieser Check-in wurde automatisch zur Prüfung markiert. Deine Punkte bleiben sichtbar, Admins können den Check-in bei Bedarf prüfen.
          </div>
        )}

        <div className="mb-4">
          <ShareButton text={shareText} />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-2xl py-3 font-bold text-white text-base"
          style={{ background: "var(--oz-brand-green)" }}
        >
          Weiter
        </button>
      </div>
    </div>
  );
}
