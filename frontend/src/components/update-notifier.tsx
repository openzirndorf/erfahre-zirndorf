import { X } from "lucide-react";
import { useState } from "react";

const STORAGE_KEY = "notifier_v3_dismissed";

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
            Montag, 13. Juli · 19:30 Uhr · <span className="font-semibold">Hotel Knorz</span>
            <br />Alle Bestplatzierten und Gewinner werden direkt kontaktiert.
          </p>
        </div>

        <p className="font-semibold text-gray-800">Neu in dieser Version:</p>

        <div className="space-y-2">
          <div className="flex gap-2">
            <span className="shrink-0">✅</span>
            <p><span className="font-semibold">„Vorschlagen"-Bereich</span>: Stops, Sponsoren, Ideen – und jetzt auch <span className="font-semibold">Support-Anfragen</span> direkt aus der App einreichen 💡</p>
          </div>
        </div>

        <div
          className="rounded-xl px-3 py-3 text-white"
          style={{ background: "linear-gradient(135deg, var(--oz-brand-green) 0%, #007a00 100%)" }}
        >
          <p className="font-bold mb-1">🎁 Freunde einladen & Punkte sammeln</p>
          <p className="text-xs opacity-90 leading-relaxed">
            Dein persönlicher Einladungscode wartet im Profil! Wer sich mit deinem Code anmeldet, bringt dir <span className="font-semibold">20 Punkte</span> – und sobald dein Geworbener 100 Punkte erreicht, gibt es nochmal <span className="font-semibold">40 Punkte</span> obendrauf. Bis zu 5 Einladungen möglich.
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
