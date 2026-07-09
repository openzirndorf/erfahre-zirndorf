import { X } from "lucide-react";
import { useState } from "react";

const STORAGE_KEY = "notifier_v4_dismissed";

export function useUpdateNotifier() {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(STORAGE_KEY) === "1");

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  }

  return { show: !dismissed, dismiss };
}

interface Props {
  onDone: () => void;
}

export function UpdateNotifier({ onDone }: Props) {
  return (
    <div className="rounded-2xl bg-white overflow-hidden mb-4" style={{ boxShadow: "var(--oz-shadow)" }}>
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ background: "linear-gradient(135deg, var(--oz-brand-green) 0%, #007a00 100%)" }}
      >
        <span className="text-white text-sm font-bold">📢 Neuigkeiten & Hinweise</span>
        <button
          type="button"
          onClick={onDone}
          className="text-white/80 hover:text-white transition-colors"
          aria-label="Schließen"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-4 py-4 space-y-3 text-sm text-gray-700 leading-relaxed">
        {/* Newsletter-Consent Hinweis */}
        <div className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-2.5">
          <p className="font-bold text-blue-800 mb-0.5">📬 Über zukünftige Aktionen informiert bleiben</p>
          <p className="text-blue-700 text-xs leading-relaxed">
            Im <span className="font-semibold">Profil</span> kannst du zustimmen, dass wir dich per E-Mail über zukünftige Aktionen informieren dürfen. Einwilligung jederzeit widerrufbar.
          </p>
        </div>

        {/* Foto-Stop Bug */}
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
          <p className="font-bold text-amber-800 mb-0.5">⚠️ Bekannter Fehler: Foto-Stops & Extrapunkte</p>
          <p className="text-amber-700 text-xs leading-relaxed">
            Foto-Stops vergeben keinen 5-Punkte-Bonus für den ersten Check-in. Herzlichen Dank an <span className="font-semibold">Veronica</span> für den Hinweis! Aus Fairnessgründen gegenüber allen bisherigen Teilnehmerinnen und Teilnehmern wird dieser Fehler nicht rückwirkend korrigiert.
          </p>
        </div>

        {/* Challenge-Anzahl Hinweis */}
        <div className="rounded-xl bg-gray-50 border border-gray-200 px-3 py-2.5">
          <p className="font-bold text-gray-800 mb-0.5">ℹ️ Challengeanzahl ggf. nicht korrekt</p>
          <p className="text-gray-600 text-xs leading-relaxed">
            Die angezeigte Anzahl abgeschlossener Challenges kann in Einzelfällen abweichen. Die <span className="font-semibold">Punkte sind davon nicht betroffen</span> und werden korrekt gewertet.
          </p>
        </div>
      </div>

      <div className="px-4 pb-4">
        <button
          type="button"
          onClick={onDone}
          className="w-full rounded-xl py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          Verstanden, schließen
        </button>
      </div>
    </div>
  );
}
