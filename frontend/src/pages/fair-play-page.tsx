import { ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

const rules = [
  "Keine Fake-Standorte, kein GPS-Spoofing und keine manipulierten Standortdaten.",
  "Keine Emulator-Tricks, Entwickleroptionen oder Tools, die den echten Aufenthaltsort verschleiern.",
  "Pro Person nur ein Account in der Wertung.",
  "Verdächtige Check-ins können geprüft, markiert, zurückgesetzt oder ungültig gewertet werden.",
  "Bei klaren Verstößen kann der Account gesperrt werden.",
];

export function FairPlayPage() {
  return (
    <div className="max-w-[480px] mx-auto px-4 pt-6 pb-28">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
          style={{ background: "var(--oz-brand-green-light)", color: "var(--oz-brand-green)" }}
        >
          <ShieldCheck className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-black mb-2" style={{ fontFamily: "var(--oz-font-heading)" }}>
          Fair Play
        </h1>
        <p className="text-sm text-gray-600 leading-relaxed mb-5">
          Erfahre Zirndorf soll draußen stattfinden. Die App nutzt technische Plausibilitätsprüfungen, aber sie bleibt auch ein gemeinsames Versprechen: ehrlich fahren, ehrlich einchecken.
        </p>
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule} className="flex gap-3 text-sm text-gray-700">
              <span className="mt-1 h-2 w-2 rounded-full shrink-0" style={{ background: "var(--oz-brand-green)" }} />
              <span>{rule}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-green-50 p-4 text-sm text-green-900">
        Wenn du versehentlich falsch markiert wurdest, melde dich bitte bei OpenZirndorf. Admins können Check-ins prüfen und wieder freigeben.
      </div>

      <Link
        to="/faq"
        className="mt-4 block text-center text-sm font-semibold underline"
        style={{ color: "var(--oz-brand-green)" }}
      >
        Zur FAQ
      </Link>
    </div>
  );
}
