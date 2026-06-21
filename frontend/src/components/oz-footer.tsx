import React from "react";
import { Link } from "react-router-dom";

export function OzFooter() {
  return (
    <footer className="mt-auto py-6 px-4 text-center text-xs text-gray-400 border-t border-gray-100 bg-white">
      <p className="mb-2">
        Ein Projekt von{" "}
        <a
          href="https://openzirndorf.de"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
          style={{ color: "var(--oz-brand-green)" }}
        >
          OpenZirndorf
        </a>
      </p>
      <p className="mb-2 text-gray-400">Infrastruktur &amp; Entwicklung: Fabian Hartmann</p>
      <div className="flex justify-center gap-4 flex-wrap mb-2">
        <a
          href="mailto:fabian@openzirndorf.de"
          className="font-semibold hover:underline"
          style={{ color: "var(--oz-brand-green)" }}
        >
          Kontakt
        </a>
        <a
          href="https://openzirndorf.de/impressum"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold hover:underline"
          style={{ color: "var(--oz-brand-green)" }}
        >
          Impressum
        </a>
        <Link to="/datenschutz" className="font-semibold hover:underline" style={{ color: "var(--oz-brand-green)" }}>
          Datenschutz
        </Link>
        <Link to="/faq" className="font-semibold hover:underline" style={{ color: "var(--oz-brand-green)" }}>
          FAQ
        </Link>
      </div>
      <div className="flex justify-center gap-4 flex-wrap">
        <Link to="/sponsoren" className="hover:underline">Sponsoren &amp; Preise</Link>
        <Link to="/teilnahmebedingungen" className="hover:underline">Teilnahmebedingungen</Link>
        <Link to="/lizenz" className="hover:underline">Lizenz</Link>
      </div>
    </footer>
  );
}
