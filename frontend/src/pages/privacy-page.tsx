import { ArrowLeft } from "lucide-react";
import React from "react";
import { useNavigate } from "react-router-dom";
import { OzFooter } from "../components/oz-footer";

export function PrivacyPage() {
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

        <h1 className="text-2xl font-black mb-6" style={{ fontFamily: "var(--oz-font-heading)" }}>
          Datenschutzerklärung
        </h1>

        <div className="prose prose-sm max-w-none text-gray-700 space-y-6">
          <section>
            <h2 className="font-bold text-gray-900">1. Verantwortlicher</h2>
            <p>
              Verantwortlich für diese Web-App ist OpenZirndorf. Kontakt über{" "}
              <a href="https://openzirndorf.de/impressum" className="underline text-green-700">
                openzirndorf.de/impressum
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900">2. Zweck</h2>
            <p>
              „Erfahre Zirndorf" ermöglicht das Anfahren von Zielorten und das freiwillige
              Check-in per GPS. Die App dient der spielerischen Entdeckung von
              Zirndorf.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900">3. GPS-Standortverarbeitung</h2>
            <p className="font-semibold text-green-700">
              Dein Standort wird nur abgefragt, wenn du aktiv auf „Jetzt einchecken" tippst.
              Es werden keine Fahrtrouten aufgezeichnet.
            </p>
            <ul className="list-disc pl-4 space-y-1 mt-2">
              <li>Einmaliger Aufruf von <code>getCurrentPosition()</code> – kein Dauertracking.</li>
              <li>Gespeichert: Zeitstempel, Distanz zum Ziel (Meter), GPS-Genauigkeit, Ergebnis.</li>
              <li>Exakte Koordinaten werden nach der Prüfung nicht dauerhaft gespeichert.</li>
              <li>Keine Hintergrundortung, kein Bewegungsprofil.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bold text-gray-900">4. Registrierungsdaten</h2>
            <p>
              Bei der Anmeldung werden E-Mail-Adresse und Anzeigename gespeichert. Die
              E-Mail wird nur für den einmaligen Anmeldelink verwendet und nicht weitergegeben.
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900">5. Widerruf und Löschung</h2>
            <p>
              Die Teilnahme ist freiwillig. Zur Löschung deiner Daten genügt eine E-Mail über{" "}
              <a href="https://openzirndorf.de/impressum" className="underline text-green-700">
                openzirndorf.de/impressum
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-bold text-gray-900">6. Hosting</h2>
            <p>
              Die App wird auf Servern in Europa 🇪🇺 (Paris) betrieben. Die Verbindung
              erfolgt ausschließlich über HTTPS. Alle Daten bleiben in Europa.
            </p>
          </section>
        </div>
      </div>

      <div className="mt-8">
        <OzFooter />
      </div>
    </div>
  );
}
