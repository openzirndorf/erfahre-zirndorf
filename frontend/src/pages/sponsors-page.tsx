import { Gift, Star } from "lucide-react";

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
    url: "https://eiscafe-mosena.eatbu.com/",
  },
  {
    name: "Kletterwald Weiherhof",
    description: "Kletterspaß für die ganze Familie direkt vor den Toren Zirndorfs.",
    url: "https://www.kletterwald-weiherhof.de/",
  },
  {
    name: "NazarDöner Zirndorf",
    description: "Frische Döner und türkische Küche mitten in Zirndorf.",
    url: "https://nazar-zirndorf.eatbu.com/",
  },
  {
    name: "AusdruckD!",
    description: "Kreative Ideen aus Zirndorf – 3D-Druck, Lasergravur und individuelle Anfertigungen.",
    url: "https://www.ausdruckd.de/",
  },
  {
    name: "helpi",
    description: "Ausrüster für Hilfsorganisationen & Polizei – Feuerwehrausrüstung, Brandschutz und Erste-Hilfe-Bedarf.",
    url: "https://www.helpishop.de/",
  },
  {
    name: "Hotel Knorz",
    description: "Familiär geführtes Hotel mitten in Zirndorf – Übernachten, wo die Stadt zu Hause ist.",
    url: "https://www.hotelknorz.de/",
  },
  {
    name: "Lennert Papeterie & mehr",
    description: "Schreibwaren, Schulbedarf und Geschenkartikel: eine feste Adresse in Zirndorf.",
    url: "https://lennert.de/",
  },
  {
    name: "Der Steinbock – Boulderhalle Zirndorf",
    description: "Bouldern in einer alten Spielzeugfabrik: Kletterfläche innen und außen und Café direkt in der Innenstadt.",
    url: "https://www.dersteinbock-zirndorf.de/",
  },
  {
    name: "Zirndorfer Bräuschank",
    description: "Gemütliche Braugaststätte mitten in Zirndorf – hausgebrautes Bier und deftige Küche.",
    url: "https://www.braeuschank.de/",
  },
  {
    name: "Bücherstube Zirndorf",
    description: "Die inhabergeführte Buchhandlung vor Ort – persönliche Beratung und große Auswahl.",
    url: "http://www.buecherstube-zirndorf.de/",
  },
  {
    name: "Café Eders",
    description: "Café zum Wohlfühlen – hausgemachte Köstlichkeiten, frischer Kaffee und Frühstücksbuffet am Wochenende.",
    url: "https://cafe-eders.de/",
  },
  {
    name: "GRUWEN BoXX",
    description: "24/7 geöffneter Verkaufsraum ohne Personal in der Siegfriedstraße 2 – regionale Produkte von Direktvermarktern aus dem Landkreis Fürth, bezahlt per Handy oder Karte.",
    url: "https://www.gruwen.de/",
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
            Die Bestplatzierten erhalten am Ende der Aktion sichere Preise. Zusätzlich verlosen wir
            unter allen Teilnehmerinnen und Teilnehmern mit mindestens 100 Punkten weitere Preise –
            wer mehr Orte schafft und mehr Punkte sammelt, hat dabei höhere Gewinnchancen.
          </p>
        </div>

        {SPONSORS.length > 0 ? (
          <div className="space-y-3">
            <div className="bg-white rounded-2xl p-5" style={{ boxShadow: "var(--oz-shadow)" }}>
              <h2 className="font-bold text-base mb-2" style={{ fontFamily: "var(--oz-font-heading)" }}>
                Danke!
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                Diese Aktion lebt von der Unterstützung lokaler Betriebe und Einrichtungen.
                Herzlichen Dank an alle Sponsoren, die Erfahre Zirndorf mit Preisen und Engagement möglich machen.
              </p>
            </div>
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
