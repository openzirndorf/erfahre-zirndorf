import { X } from "lucide-react";
import React, { useState } from "react";

const STORAGE_KEY = "notifier_v2_dismissed";

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
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
          <p className="font-bold text-amber-800 mb-0.5">🏆 Gewinnübergabe</p>
          <p className="text-amber-700 text-xs">
            Sonntag, 13. Juli · 19:30 Uhr · <span className="font-semibold">Hotel Knorz</span>
            <br />Alle Bestplatzierten und Gewinner werden direkt kontaktiert.
          </p>
        </div>

        <p className="font-semibold text-gray-800">Vielen Dank für euer super Feedback! Folgende Ideen konnten wir bereits umsetzen:</p>

        <div className="space-y-2">
          <div className="flex gap-2">
            <span className="shrink-0">✅</span>
            <p>Der <span className="font-semibold">Frühstart-Bonus</span> gilt ab jetzt nicht mehr nur für den ersten Tag, sondern für die <span className="font-semibold">ersten beiden Tage</span>!</p>
          </div>
          <div className="flex gap-2">
            <span className="shrink-0">✅</span>
            <p>Neuer <span className="font-semibold">„Vorschlagen"-Bereich</span>: Registrierte User können ab jetzt unkompliziert Vorschläge für Stops, Sponsoren oder generelle Ideen einreichen 💡</p>
          </div>
        </div>

        <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2.5 text-xs text-gray-600">
          <p className="font-semibold text-gray-700 mb-1">⏳ Ladezeiten zu Rand- & Nachtzeiten</p>
          <p>
            Gerade zu Rand- und Nachtzeiten kann die App etwas länger zum Laden brauchen – die Technik im Hintergrund schaltet sich bei Inaktivität automatisch ab, um Kosten zu sparen (die ehrenamtlich von einer Einzelperson getragen werden 🙏).
          </p>
          <p className="mt-1.5 font-medium text-gray-700">
            💡 Tipp: Einfach kurz warten – beim nächsten Aufruf direkt danach läuft alles wieder gewohnt schnell!
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
