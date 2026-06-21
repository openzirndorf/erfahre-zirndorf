import { LogIn, Mail } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { requestMagicLink, verifyMagicLink } from "../api/client";
import { OzFooter } from "../components/oz-footer";
import type { AuthState } from "../types";

function getTokenFromHash(): string | null {
  const hash = window.location.hash;
  const qIndex = hash.indexOf("?");
  if (qIndex === -1) return null;
  return new URLSearchParams(hash.slice(qIndex + 1)).get("token");
}

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const consent = true;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [loginCode, setLoginCode] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const token = getTokenFromHash();
    if (token) {
      verifyMagicLink(token)
        .then((auth: AuthState) => { localStorage.setItem("auth", JSON.stringify(auth)); navigate("/profil"); })
        .catch((e) => {
          const msg: string = e.message ?? "";
          if (msg.toLowerCase().includes("abgelaufen") || msg.toLowerCase().includes("ungültig") || msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("expired")) {
            setError("expired");
          } else {
            setError(msg);
          }
        });
    }
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await requestMagicLink(email, undefined, consent, undefined);
      if (res.dev_token) setDevToken(res.dev_token);
      if (res.dev_code) setDevCode(res.dev_code);
      setSent(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fehler";
      if (msg.toLowerCase().includes("anzeigenamen")) {
        setError("Diese E-Mail ist noch nicht registriert. Bitte erst ein Konto erstellen.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDevVerify() {
    if (!devToken) return;
    try {
      const auth = await verifyMagicLink(devToken);
      localStorage.setItem("auth", JSON.stringify(auth));
      navigate("/profil");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    }
  }

  async function handleCodeVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const auth = await verifyMagicLink(loginCode);
      localStorage.setItem("auth", JSON.stringify(auth));
      navigate("/profil");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-dvh flex flex-col bg-gray-50">
        <main className="max-w-[480px] w-full mx-auto px-4 pt-10 text-center pb-10">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "var(--oz-brand-green)" }}>
            <Mail className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black mb-2" style={{ fontFamily: "var(--oz-font-heading)" }}>
            E-Mail ist unterwegs
          </h1>
          <p className="text-gray-600 text-sm mb-6">
            Öffne deine E-Mail, kopiere den Code und gib ihn hier ein. Der Link in der Mail ist nur eine Alternative.
          </p>
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-left text-sm text-amber-800 mb-4">
            Falls die E-Mail nicht gleich ankommt, schau bitte auch im Spamordner nach.
          </p>

          <form onSubmit={handleCodeVerify} className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 text-left mb-4">
            <label className="block text-sm font-semibold">Code aus der E-Mail</label>
            <input type="text" inputMode="text" autoCapitalize="characters" value={loginCode}
              onChange={(e) => setLoginCode(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-center text-lg font-mono tracking-[0.2em] uppercase focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="ABCD1234" />
            <button type="submit" disabled={loading || loginCode.trim().length < 6}
              className="w-full rounded-xl py-3 font-bold text-white disabled:opacity-50"
              style={{ background: "var(--oz-brand-green)" }}>
              {loading ? "Prüfe Code ..." : "Anmelden"}
            </button>
          </form>

          {error && <div className="rounded-xl p-3 bg-red-50 text-red-700 text-sm mb-4 text-left">{error}</div>}

          {devToken && (
            <div className="space-y-3 mb-4">
              <div className="rounded-xl bg-gray-100 px-4 py-3 text-xs font-mono break-all text-gray-700 text-left">{devToken}</div>
              {devCode && <div className="rounded-xl bg-gray-100 px-4 py-3 text-sm font-mono tracking-[0.2em] text-gray-700">{devCode}</div>}
              <button type="button" onClick={handleDevVerify}
                className="w-full rounded-xl py-3 font-bold text-white"
                style={{ background: "var(--oz-brand-green)" }}>
                Dev-Login öffnen
              </button>
            </div>
          )}

          <button type="button" onClick={() => { setSent(false); setDevToken(null); setDevCode(null); setLoginCode(""); }}
            className="text-sm underline text-gray-500">
            Andere E-Mail verwenden
          </button>
        </main>
        <OzFooter />
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-gray-50">
      <main className="max-w-[480px] w-full mx-auto px-4 pt-8 pb-10">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-4"
            style={{ background: "var(--oz-brand-green)" }}>
            <LogIn className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-black" style={{ fontFamily: "var(--oz-font-heading)" }}>
            Schon registriert?
          </h1>
          <p className="text-gray-500 text-sm mt-1">Gib deine E-Mail ein. Du bekommst einen Code zum Anmelden.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-200 bg-white p-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5">E-Mail-Adresse</label>
            <input type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="deine@email.de" />
          </div>

          {error === "expired" ? (
            <div className="rounded-xl p-4 bg-orange-50 border border-orange-200 text-sm text-orange-800 space-y-2">
              <p className="font-semibold">Der Login-Link ist abgelaufen.</p>
              <p className="text-orange-700">Links sind 15 Minuten gültig. Gib deine E-Mail-Adresse ein und fordere einen neuen an.</p>
              <button type="button" onClick={() => setError(null)}
                className="text-sm font-semibold underline" style={{ color: "var(--oz-brand-green)" }}>
                Neuen Link anfordern →
              </button>
            </div>
          ) : error ? (
            <div className="rounded-xl p-3 bg-red-50 text-red-700 text-sm">
              {error}
              {error.includes("registriert") && (
                <div className="mt-2">
                  <Link to="/registrieren" style={{ color: "var(--oz-brand-green)" }} className="font-semibold underline">
                    Konto erstellen
                  </Link>
                </div>
              )}
            </div>
          ) : null}

          <button type="submit" disabled={loading}
            className="w-full rounded-xl py-4 font-bold text-white text-base disabled:opacity-50 active:scale-[0.98]"
            style={{ background: "var(--oz-brand-green)" }}>
            {loading ? "Wird gesendet ..." : "Code per E-Mail senden"}
          </button>
        </form>

        <form onSubmit={handleCodeVerify} className="mt-4 space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <div>
            <label className="block text-sm font-semibold mb-1.5">Du hast schon einen Code?</label>
            <input type="text" inputMode="text" autoCapitalize="characters" value={loginCode}
              onChange={(e) => setLoginCode(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-base font-mono tracking-[0.2em] uppercase focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="ABCD1234" />
          </div>
          <button type="submit" disabled={loading || loginCode.trim().length < 6}
            className="w-full rounded-xl py-3 font-bold text-white disabled:opacity-50"
            style={{ background: "var(--oz-brand-green)" }}>
            Mit Code anmelden
          </button>
        </form>

        <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-center">
          <p className="text-sm font-semibold text-gray-800 mb-3">Neu hier?</p>
          <Link to="/registrieren"
            className="block w-full rounded-xl py-3 font-bold text-white active:scale-[0.98]"
            style={{ background: "var(--oz-brand-green)" }}>
            Jetzt registrieren
          </Link>
        </div>
        <p className="text-xs text-gray-400 text-center mt-3">
          Problem beim Anmelden?{" "}
          <a href="mailto:fabian@openzirndorf.de" className="underline" style={{ color: "var(--oz-brand-green)" }}>
            Kontakt aufnehmen
          </a>
        </p>
      </main>
      <OzFooter />
    </div>
  );
}
