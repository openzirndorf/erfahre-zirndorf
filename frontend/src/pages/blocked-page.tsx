import { Ban, Mail } from "lucide-react";
import React from "react";
import { Link } from "react-router-dom";

const BLOCKED_STORAGE_KEY = "blocked-account-message";

export function BlockedPage() {
  const message =
    sessionStorage.getItem(BLOCKED_STORAGE_KEY) ??
    "Dein Account wurde gesperrt. Bitte wende dich an OpenZirndorf.";

  return (
    <div className="max-w-[480px] mx-auto px-4 pt-10 pb-24 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-red-50">
        <Ban className="w-8 h-8 text-red-600" />
      </div>

      <h1 className="text-2xl font-black mb-2" style={{ fontFamily: "var(--oz-font-heading)" }}>
        Account gesperrt
      </h1>

      <p className="text-sm text-gray-600 leading-relaxed mb-6">{message}</p>

      <a
        href="https://openzirndorf.de/impressum"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-center gap-2 w-full rounded-2xl py-4 font-bold text-white no-underline"
        style={{ background: "var(--oz-brand-green)" }}
      >
        <Mail className="w-5 h-5" />
        Kontakt aufnehmen
      </a>

      <Link to="/" className="inline-block mt-4 text-sm text-gray-500 underline">
        Zur Startseite
      </Link>
    </div>
  );
}
