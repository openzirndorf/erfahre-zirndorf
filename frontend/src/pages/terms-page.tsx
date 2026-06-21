import { ArrowLeft, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { OzFooter } from "../components/oz-footer";

const sections = [
  {
    title: "Teilnahme",
    text: "Mitmachen kann jede Person, die die App fair nutzt und die Standortabfrage nur für echte Check-ins verwendet. Pro Person ist ein Account für die Wertung vorgesehen.",
  },
  {
    title: "Wertung",
    text: "Punkte gibt es für erfolgreiche Check-ins an freigeschalteten Orten. Bonuspunkte können für erste Check-ins oder Check-ins am Freischalttag vergeben werden. Die Rangliste ist eine spielerische, inoffizielle Wertung.",
  },
  {
    title: "Fair Play",
    text: "GPS-Spoofing, Fake-Standorte, Emulator-Tricks, manipulierte Standortdaten und Doppelaccounts sind nicht erlaubt. Verdächtige Check-ins können geprüft, markiert, zurückgesetzt oder ungültig gewertet werden.",
  },
  {
    title: "Sperren und Korrekturen",
    text: "Bei klaren Verstößen kann ein Account gesperrt werden. Admins können Punkte, Check-ins und Sperren korrigieren, wenn technische Probleme oder Fehlmarkierungen auftreten.",
  },
  {
    title: "Preise",
    text: "Am Ende der Aktion (6. Juni – 12. Juli 2026) werden Preise an die Bestplatzierten vergeben sowie weitere Preise verlost. Die Preise werden von Sponsoren gestiftet. Ein Rechtsanspruch auf einen bestimmten Preis besteht nicht. Die Gewinner werden direkt kontaktiert.",
  },
  {
    title: "Kein Rechtsanspruch",
    text: "Die Aktion ist freiwillig und wird ehrenamtlich betrieben. Es besteht kein Anspruch auf bestimmte Platzierungen oder durchgehende technische Verfügbarkeit.",
  },
];

export function TermsPage() {
  const navigate = useNavigate();

  return (
    <div className="max-w-[480px] mx-auto pb-24 md:pb-6">
      <div className="px-4 pt-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Zurück
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: "var(--oz-brand-green-light)", color: "var(--oz-brand-green)" }}
          >
            <FileText className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-black" style={{ fontFamily: "var(--oz-font-heading)" }}>
            Teilnahmebedingungen
          </h1>
        </div>

        <div className="space-y-4">
          {sections.map((section, index) => (
            <section key={section.title} className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-2">
                {index + 1}. {section.title}
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed">{section.text}</p>
            </section>
          ))}
        </div>
      </div>

      <div className="mt-8">
        <OzFooter />
      </div>
    </div>
  );
}
