import { Gift, Star } from "lucide-react";
import React from "react";
import { OzFooter } from "../components/oz-footer";

interface Sponsor {
  name: string;
  description: string;
  logo?: string;
  url?: string;
  prize?: string;
}

const SPONSORS: Sponsor[] = [
  {
    name: "Eiscafe Mosena",
    description: "Eiscafe in Zirndorf – für eine süße Auszeit nach dem Check-in.",
  },
  {
    name: "Kletterwald Weiherhof",
    description: "Kletterspaß für die ganze Familie direkt vor den Toren Zirndorfs.",
  },
  {
    name: "NazarDöner Zirndorf",
    description: "Frische Döner und türkische Küche mitten in Zirndorf.",
  },
  {
    name: "helpi",
    description: "Ausrüster für Hilfsorganisationen & Polizei – Feuerwehrausrüstung, Brandschutz und Erste-Hilfe-Bedarf.",
  },
  {
    name: "Hotel Knorz",
    description: "Familiär geführtes Hotel mitten in Zirndorf – Übernachten, wo die Stadt zu Hause ist.",
  },
];

export function SponsorsPage() {
  return (
    <div className="max-w-[480px] mx-auto pb-24 md:pb-6">
      <div className="px-4 pt-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <Gift className="w-5 h-5" style={{ color: "var(--oz-brand-green)" }} />
          <h1 className="text-xl font-black" style={{ fontFamily: "var(--oz-font-heading)" }}>
            Sponsoren &amp; Preise
          </h1>
        </div>

        <div
          className="rounded-2xl p-5 text-white"
          style={{ background: "linear-gradient(135deg, var(--oz-brand-green) 0%, #007a00 100%)" }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-5 h-5 text-yellow-300 fill-yellow-300" />
            <h2 className="font-bold text-base" style={{ fontFamily: "var(--oz-font-heading)" }}>
              Preise gewinnen
            </h2>
          </div>
          <p className="text-sm opacity-90">
            Die Bestplatzierten erhalten am Ende der Aktion sichere Preise. Zusätzlich werden
            unter allen Teilnehmerinnen und Teilnehmern weitere Preise verlost – je mehr Orte
            du besuchst, desto größer deine Gewinnchance.
          </p>
        </div>

        {SPONSORS.length > 0 ? (
          <div className="space-y-3">
            <h2 className="font-bold text-base" style={{ fontFamily: "var(--oz-font-heading)" }}>
              Unsere Sponsoren
            </h2>
            {SPONSORS.map((s) => (
              <div key={s.name} className="bg-white rounded-2xl p-4" style={{ boxShadow: "var(--oz-shadow)" }}>
                <div className="flex items-start gap-3">
                  {s.logo && (
                    <img src={s.logo} alt={s.name} className="w-12 h-12 object-contain rounded-xl shrink-0" />
                  )}
                  <div className="min-w-0">
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noopener noreferrer"
                        className="font-bold text-sm underline" style={{ color: "var(--oz-brand-green)" }}>
                        {s.name}
                      </a>
                    ) : (
                      <p className="font-bold text-sm text-gray-900">{s.name}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-0.5">{s.description}</p>
                    {s.prize && (
                      <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold"
                        style={{ color: "var(--oz-brand-green)" }}>
                        <Gift className="w-3.5 h-3.5 shrink-0" />
                        {s.prize}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-5 text-center" style={{ boxShadow: "var(--oz-shadow)" }}>
            <Gift className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm text-gray-500">Details zu Sponsoren und Preisen folgen in Kürze.</p>
          </div>
        )}

        <div className="bg-white rounded-2xl p-5" style={{ boxShadow: "var(--oz-shadow)" }}>
          <h2 className="font-bold text-base mb-2" style={{ fontFamily: "var(--oz-font-heading)" }}>
            Sponsor werden?
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed">
            Du möchtest die Aktion unterstützen und einen Preis stiften? Melde dich gerne –
            wir freuen uns über lokale Partner aus Zirndorf und Umgebung.
          </p>
          <a
            href="mailto:fabian@openzirndorf.de"
            className="inline-block mt-3 text-sm font-semibold underline"
            style={{ color: "var(--oz-brand-green)" }}
          >
            fabian@openzirndorf.de →
          </a>
        </div>
      </div>

      <div className="mt-6">
        <OzFooter />
      </div>
    </div>
  );
}
