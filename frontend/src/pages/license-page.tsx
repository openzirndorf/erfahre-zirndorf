import { Scale } from "lucide-react";
import React from "react";
import { OzFooter } from "../components/oz-footer";

export function LicensePage() {
  return (
    <div className="max-w-[480px] mx-auto pb-24 md:pb-6">
      <div className="px-4 pt-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <Scale className="w-5 h-5" style={{ color: "var(--oz-brand-green)" }} />
          <h1 className="text-xl font-black" style={{ fontFamily: "var(--oz-font-heading)" }}>
            Lizenz
          </h1>
        </div>

        <div className="bg-white rounded-2xl p-5 space-y-4" style={{ boxShadow: "var(--oz-shadow)" }}>
          <div>
            <h2 className="font-bold text-base mb-1" style={{ fontFamily: "var(--oz-font-heading)" }}>
              MIT-Lizenz mit Landkreis-Fürth-Klausel
            </h2>
            <p className="text-xs text-gray-500">Copyright © 2025–2026 openzirndorf Contributors</p>
          </div>

          <p className="text-sm text-gray-700 leading-relaxed">
            Diese Software ist quelloffen und darf frei verwendet, kopiert, verändert und
            weitergegeben werden – auch kommerziell – unter den folgenden Bedingungen:
          </p>

          <div className="rounded-xl p-4 text-sm space-y-2" style={{ background: "var(--oz-bg-surface)" }}>
            <p className="font-semibold text-gray-800">Landkreis-Fürth-Klausel</p>
            <p className="text-gray-700 leading-relaxed">
              Wer diese Software zum Betrieb eines GPS-Check-in-Events, einer Radtour-Challenge
              oder eines vergleichbaren Formats <strong>im Landkreis Fürth</strong> einsetzt,
              muss:
            </p>
            <ul className="list-disc list-inside space-y-1 text-gray-700">
              <li>
                in der App gut sichtbar den Hinweis{" "}
                <span className="font-semibold">„Powered by openzirndorf"</span> platzieren,
              </li>
              <li>
                in öffentlicher Kommunikation zum Event (Flyer, Social Media, Presse)
                das Projekt <span className="font-semibold">openzirndorf</span> als Urheber nennen.
              </li>
            </ul>
            <p className="text-xs text-gray-500 pt-1">
              Kurzfassung: Event im Landkreis Fürth? Dann sag „Danke, openzirndorf."
            </p>
          </div>

          <p className="text-sm text-gray-600 leading-relaxed">
            Die Software wird ohne jegliche Gewährleistung bereitgestellt. Die Urheber haften
            nicht für Schäden, die aus der Nutzung entstehen.
          </p>

          <a
            href="https://github.com/openzirndorf/biking/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold underline"
            style={{ color: "var(--oz-brand-green)" }}
          >
            Vollständiger Lizenztext auf GitHub →
          </a>
        </div>

        <div className="bg-white rounded-2xl p-5" style={{ boxShadow: "var(--oz-shadow)" }}>
          <h2 className="font-bold text-base mb-3" style={{ fontFamily: "var(--oz-font-heading)" }}>
            Verwendete Open-Source-Bibliotheken
          </h2>
          <div className="space-y-2 text-sm text-gray-600">
            {[
              { name: "FastAPI", license: "MIT", url: "https://fastapi.tiangolo.com" },
              { name: "React", license: "MIT", url: "https://react.dev" },
              { name: "MapLibre GL JS", license: "BSD-3-Clause", url: "https://maplibre.org" },
              { name: "OpenFreeMap", license: "ODbL / CC-BY", url: "https://openfreemap.org" },
              { name: "Tailwind CSS", license: "MIT", url: "https://tailwindcss.com" },
              { name: "SQLAlchemy", license: "MIT", url: "https://sqlalchemy.org" },
              { name: "Altcha", license: "MIT", url: "https://altcha.org" },
            ].map((lib) => (
              <div key={lib.name} className="flex items-center justify-between">
                <a
                  href={lib.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                  style={{ color: "var(--oz-brand-green)" }}
                >
                  {lib.name}
                </a>
                <span className="text-xs text-gray-400 font-mono">{lib.license}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <OzFooter />
      </div>
    </div>
  );
}
