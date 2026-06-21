import { X } from "lucide-react";
import React, { useEffect, useState } from "react";

const STORAGE_KEY = "survey_done";

const Q1_OPTIONS = [
  "Freunde / Familie",
  "Instagram",
  "Facebook",
  "Flyer / Plakat",
  "Sonstiges",
];

const Q2_OPTIONS = [
  "Zirndorf entdecken",
  "Bewegung & Sport",
  "Stadtradeln",
  "Spaß & Punkte",
  "Mit Familie / Freunden",
];

const Q3_OPTIONS = ["Ja, auf jeden Fall!", "Vielleicht", "Nein"];
const Q4_OPTIONS = ["Ja, auf jeden Fall!", "Vielleicht", "Nein"];

interface Props {
  onDone: () => void;
}

function RadioGroup({
  question,
  options,
  value,
  onChange,
}: {
  question: string;
  options: string[];
  value: string | null;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-700 mb-2">{question}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className={`rounded-full px-3 py-1 text-xs font-semibold border transition-all ${
              value === o
                ? "border-transparent text-white"
                : "border-gray-200 text-gray-600 bg-white"
            }`}
            style={value === o ? { background: "var(--oz-brand-green)" } : {}}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SurveyCard({ onDone }: Props) {
  const [q1, setQ1] = useState<string | null>(null);
  const [q2, setQ2] = useState<string | null>(null);
  const [q3, setQ3] = useState<string | null>(null);
  const [q4, setQ4] = useState<string | null>(null);
  const [q5, setQ5] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    try {
      const raw = localStorage.getItem("auth");
      const token = raw ? (JSON.parse(raw) as { token: string }).token : null;
      const base = `${(import.meta as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL ?? ""}/api`;
      await fetch(`${base}/survey`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ q1, q2, q3, q4, q5: q5 || null }),
      });
    } catch {
      // silent — auch bei Fehler als erledigt markieren
    }
    localStorage.setItem(STORAGE_KEY, "1");
    setSubmitting(false);
    onDone();
  }

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    onDone();
  }

  const hasAnswer = q1 || q2 || q3 || q4;

  return (
    <div className="rounded-2xl bg-white border border-gray-100 shadow-sm p-4 mb-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="font-bold text-sm text-gray-900">Kurze Umfrage</p>
          <p className="text-xs text-gray-500">Hilf uns, die App zu verbessern – dauert 1 Minute.</p>
        </div>
        <button type="button" onClick={dismiss} className="shrink-0 p-1 text-gray-400 hover:text-gray-600">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-4">
        <RadioGroup
          question="Wo hast du von der App erfahren?"
          options={Q1_OPTIONS}
          value={q1}
          onChange={setQ1}
        />
        <RadioGroup
          question="Warum machst du mit?"
          options={Q2_OPTIONS}
          value={q2}
          onChange={setQ2}
        />
        <RadioGroup
          question="Fändest du Teams interessant?"
          options={Q3_OPTIONS}
          value={q3}
          onChange={setQ3}
        />
        <RadioGroup
          question="Fändest du Quize und Aufgaben interessant?"
          options={Q4_OPTIONS}
          value={q4}
          onChange={setQ4}
        />

        <div>
          <p className="text-xs font-semibold text-gray-700 mb-1">
            Was wünschst du noch?{" "}
            <span className="text-gray-400 font-normal">(optional)</span>
          </p>
          <textarea
            className="w-full rounded-xl border border-gray-200 text-xs p-2 resize-none focus:outline-none focus:ring-1"
            style={{ "--tw-ring-color": "var(--oz-brand-green)" } as React.CSSProperties}
            rows={2}
            placeholder="z.B. Push-Benachrichtigungen, Offline-Modus, …"
            value={q5}
            onChange={(e) => setQ5(e.target.value)}
          />
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={submitting || !hasAnswer}
          className="w-full rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-40 transition-opacity"
          style={{ background: "var(--oz-brand-green)" }}
        >
          {submitting ? "Wird gesendet …" : "Absenden"}
        </button>
      </div>
    </div>
  );
}

export function useSurvey(hasCheckins: boolean) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (hasCheckins && !localStorage.getItem(STORAGE_KEY)) {
      setShow(true);
    }
  }, [hasCheckins]);
  return { show, dismiss: () => setShow(false) };
}
