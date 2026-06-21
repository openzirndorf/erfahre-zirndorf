import { ArrowLeft, Camera, CheckCircle2, Loader2, MapPin, MessageCircle, Send, X } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../api/client";

function isLoggedIn(): boolean {
  try { return !!JSON.parse(localStorage.getItem("auth") ?? "null")?.token; } catch { return false; }
}

type SuggestionType = "stop" | "sponsor" | "idea" | "support";

const TYPE_OPTIONS: { value: SuggestionType; label: string; description: string }[] = [
  { value: "stop", label: "Stop vorschlagen", description: "Ein Ort, der als Check-in-Punkt passen würde" },
  { value: "sponsor", label: "Sponsor melden", description: "Ein lokales Unternehmen, das die Aktion unterstützen könnte" },
  { value: "idea", label: "Idee teilen", description: "Sonstiger Verbesserungsvorschlag oder Feedback" },
  { value: "support", label: "Support-Anfrage", description: "Problem mit einem Stop oder technische Hilfe" },
];

interface MySuggestion {
  id: number;
  type: string;
  text: string;
  created_at: string;
  admin_reply: string | null;
  admin_reply_at: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  stop: "Stop", sponsor: "Sponsor", idea: "Idee", support: "Support",
};

async function resizeImage(file: File, maxPx = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => {
      img.src = e.target!.result as string;
      img.onload = () => {
        let { width, height } = img;
        if (width > height) {
          if (width > maxPx) { height = Math.round(height * maxPx / width); width = maxPx; }
        } else {
          if (height > maxPx) { width = Math.round(width * maxPx / height); height = maxPx; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function MeldenPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<SuggestionType>("stop");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [locState, setLocState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [lat, setLat] = useState<number | null>(null);
  const [lon, setLon] = useState<number | null>(null);

  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);

  const [myMessages, setMyMessages] = useState<MySuggestion[]>([]);

  useEffect(() => {
    if (!isLoggedIn()) return;
    apiFetch<MySuggestion[]>("/suggestions/mine").then(setMyMessages).catch(() => {});
  }, [done]);

  async function handleGetLocation() {
    if (!navigator.geolocation) { setLocState("error"); return; }
    setLocState("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLon(pos.coords.longitude);
        setLocState("done");
      },
      () => setLocState("error"),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageLoading(true);
    try {
      const resized = await resizeImage(file);
      setImageBase64(resized);
    } catch {
      setError("Foto konnte nicht verarbeitet werden.");
    } finally {
      setImageLoading(false);
      e.target.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    try {
      await apiFetch("/suggestions", {
        method: "POST",
        body: JSON.stringify({
          type,
          text,
          lat: lat ?? undefined,
          lon: lon ?? undefined,
          image_base64: imageBase64 ?? undefined,
        }),
      });
      setDone(true);
      setText("");
      setLat(null); setLon(null); setLocState("idle");
      setImageBase64(null);
    } catch {
      setError("Konnte nicht gesendet werden. Bitte versuche es erneut.");
    } finally {
      setSending(false);
    }
  }

  const isStop = type === "stop";

  return (
    <div className="max-w-[480px] mx-auto pb-24 md:pb-6 px-4 pt-4">
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
          <Send className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-black" style={{ fontFamily: "var(--oz-font-heading)" }}>
            Kontakt
          </h1>
          <p className="text-sm text-gray-500">Schreib uns – Vorschläge, Ideen oder Support.</p>
        </div>
      </div>

      {done ? (
        <div className="bg-white rounded-2xl p-6 text-center" style={{ boxShadow: "var(--oz-shadow)" }}>
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: "var(--oz-brand-green-light)" }}
          >
            <Send className="w-6 h-6" style={{ color: "var(--oz-brand-green)" }} />
          </div>
          <h2 className="font-black text-lg mb-2" style={{ fontFamily: "var(--oz-font-heading)" }}>Danke!</h2>
          <p className="text-sm text-gray-600 mb-5">
            {type === "support"
              ? "Deine Anfrage wurde übermittelt. Wir melden uns hier in dieser Ansicht."
              : "Dein Vorschlag wurde übermittelt. Wir schauen ihn uns an."}
          </p>
          <button
            type="button"
            onClick={() => setDone(false)}
            className="w-full rounded-2xl py-3 font-bold text-white"
            style={{ background: "var(--oz-brand-green)" }}
          >
            Weiteren Vorschlag senden
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Typ-Auswahl */}
          <div className="bg-white rounded-2xl p-4 space-y-2" style={{ boxShadow: "var(--oz-shadow)" }}>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Was möchtest du melden?</label>
            {TYPE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer border-2 transition-colors ${
                  type === opt.value ? "border-[--oz-brand-green] bg-green-50" : "border-transparent bg-gray-50 hover:bg-gray-100"
                }`}
              >
                <input
                  type="radio"
                  name="type"
                  value={opt.value}
                  checked={type === opt.value}
                  onChange={() => { setType(opt.value); setLat(null); setLon(null); setLocState("idle"); setImageBase64(null); }}
                  className="mt-0.5 accent-[--oz-brand-green]"
                />
                <div>
                  <p className="font-semibold text-sm text-gray-900">{opt.label}</p>
                  <p className="text-xs text-gray-500">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>

          {/* Freitext */}
          <div className="bg-white rounded-2xl p-4" style={{ boxShadow: "var(--oz-shadow)" }}>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              {type === "support" ? "Deine Anfrage" : "Dein Vorschlag"}
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder={
                type === "stop"
                  ? `z.B. "Der Stadtpark an der Zirndorfer Straße wäre ein toller Stopp – schöner Rastplatz mit Brunnen."`
                  : type === "sponsor"
                  ? `z.B. "Die Bäckerei Müller in der Hauptstraße wäre sicher interessiert."`
                  : type === "support"
                  ? `z.B. "Beim Stop Rathaus kann ich nicht einchecken, obwohl ich direkt davor stehe."`
                  : `z.B. "Wäre cool, wenn man Stops auch vorschlagen könnte."`
              }
              required
              className="w-full rounded-xl border border-gray-200 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[--oz-brand-green]"
            />
          </div>

          {/* Standort + Foto – nur bei Stop */}
          {isStop && (
            <div className="bg-white rounded-2xl p-4 space-y-3" style={{ boxShadow: "var(--oz-shadow)" }}>
              <p className="text-sm font-semibold text-gray-700">Optional: Standort & Foto</p>

              {locState === "done" && lat !== null && lon !== null ? (
                <div className="flex items-center justify-between rounded-xl bg-green-50 px-3 py-2">
                  <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--oz-brand-green)" }}>
                    <MapPin className="w-4 h-4" />
                    {lat.toFixed(5)}, {lon.toFixed(5)}
                  </span>
                  <button type="button" onClick={() => { setLat(null); setLon(null); setLocState("idle"); }} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGetLocation}
                  disabled={locState === "loading"}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold border-2 transition-all disabled:opacity-60"
                  style={{ borderColor: "var(--oz-brand-green)", color: "var(--oz-brand-green)" }}
                >
                  {locState === "loading"
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Standort wird ermittelt…</>
                    : locState === "error"
                    ? <><MapPin className="w-4 h-4" />Standort nicht verfügbar</>
                    : <><MapPin className="w-4 h-4" />Aktuellen Standort teilen</>
                  }
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoChange}
              />

              {imageBase64 ? (
                <div className="relative">
                  <img
                    src={imageBase64}
                    alt="Vorschau"
                    className="w-full rounded-xl object-cover"
                    style={{ maxHeight: "200px" }}
                  />
                  <button
                    type="button"
                    onClick={() => setImageBase64(null)}
                    className="absolute top-2 right-2 rounded-full bg-black/50 p-1 text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={imageLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold border-2 border-gray-200 text-gray-600 hover:border-gray-300 transition-all disabled:opacity-60"
                >
                  {imageLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Wird verarbeitet…</>
                    : <><Camera className="w-4 h-4" />Foto aufnehmen oder auswählen</>
                  }
                </button>
              )}

              {locState === "done" && imageBase64 && (
                <p className="text-xs text-center flex items-center justify-center gap-1" style={{ color: "var(--oz-brand-green)" }}>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Standort und Foto werden mitgesendet
                </p>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-600 text-center">{error}</p>}

          <button
            type="submit"
            disabled={sending || !text.trim()}
            className="w-full rounded-2xl py-3 font-bold text-white text-base disabled:opacity-50 transition-opacity"
            style={{ background: "var(--oz-brand-green)" }}
          >
            {sending ? "Wird gesendet…" : "Absenden"}
          </button>
        </form>
      )}

      {/* Meine Nachrichten */}
      {myMessages.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-3">
            <MessageCircle className="w-4 h-4" style={{ color: "var(--oz-brand-green)" }} />
            <h2 className="text-sm font-bold text-gray-800">Meine Nachrichten</h2>
          </div>
          <div className="space-y-3">
            {myMessages.map((msg) => (
              <div key={msg.id} className="bg-white rounded-2xl p-4" style={{ boxShadow: "var(--oz-shadow)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    {TYPE_LABEL[msg.type] ?? msg.type}
                  </span>
                  <span className="text-xs text-gray-400">
                    {new Date(msg.created_at).toLocaleDateString("de-DE", { day: "numeric", month: "short" })}
                  </span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.text}</p>
                {msg.admin_reply ? (
                  <div className="mt-3 rounded-xl p-3" style={{ background: "var(--oz-brand-green-light)" }}>
                    <p className="text-xs font-bold mb-1" style={{ color: "var(--oz-brand-green)" }}>Antwort vom Team</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{msg.admin_reply}</p>
                    {msg.admin_reply_at && (
                      <p className="text-[10px] text-gray-400 mt-1">
                        {new Date(msg.admin_reply_at).toLocaleDateString("de-DE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-gray-400">Noch keine Antwort.</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
