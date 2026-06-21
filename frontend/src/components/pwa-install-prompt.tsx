import { Download, Share, X } from "lucide-react";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const DISMISSED_KEY = "pwa-install-dismissed-until";
const DISMISS_DAYS = 7; // nach 7 Tagen nochmal fragen

function isDismissed() {
  const until = localStorage.getItem(DISMISSED_KEY);
  if (!until) return false;
  return Date.now() < Number(until);
}

function dismiss() {
  localStorage.setItem(DISMISSED_KEY, String(Date.now() + DISMISS_DAYS * 86_400_000));
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true)
  );
}

export function PwaInstallPrompt() {
  const [nativeEvent, setNativeEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isInStandaloneMode() || isDismissed()) return;

    if (isIos()) {
      // iOS: kein beforeinstallprompt, aber nach 3 Sekunden Hinweis zeigen
      const t = setTimeout(() => setShowIosHint(true), 3000);
      return () => clearTimeout(t);
    }

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setNativeEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  async function installNative() {
    if (!nativeEvent) return;
    await nativeEvent.prompt();
    const choice = await nativeEvent.userChoice;
    if (choice.outcome === "accepted") {
      localStorage.setItem(DISMISSED_KEY, String(Date.now() + 365 * 86_400_000)); // nie mehr fragen
    } else {
      dismiss();
    }
    setVisible(false);
    setNativeEvent(null);
  }

  function handleDismiss() {
    dismiss();
    setVisible(false);
    setShowIosHint(false);
  }

  // Android / Chrome / Edge
  if (visible && nativeEvent) {
    return (
      <div className="fixed left-0 right-0 z-[65] px-4 oz-install-prompt">
        <div className="max-w-[480px] mx-auto rounded-2xl bg-white border border-green-100 px-4 py-3 shadow-xl">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "var(--oz-brand-green-light)", color: "var(--oz-brand-green)" }}
            >
              <Download className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900">App installieren</p>
              <p className="text-xs text-gray-500 mb-2">Direkt vom Startbildschirm starten – offline nutzbar.</p>
              <button
                type="button"
                onClick={installNative}
                className="rounded-xl px-4 py-2 text-xs font-bold text-white"
                style={{ background: "var(--oz-brand-green)" }}
              >
                Jetzt installieren
              </button>
            </div>
            <button type="button" onClick={handleDismiss} className="rounded-md p-1 text-gray-400 shrink-0" aria-label="Schließen">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // iOS Safari
  if (showIosHint) {
    return (
      <div className="fixed left-0 right-0 z-[65] px-4 oz-install-prompt">
        <div className="max-w-[480px] mx-auto rounded-2xl bg-white border border-green-100 px-4 py-3 shadow-xl">
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "var(--oz-brand-green-light)", color: "var(--oz-brand-green)" }}
            >
              <Share className="w-5 h-5" style={{ color: "var(--oz-brand-green)" }} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900">App zum Startbildschirm</p>
              <p className="text-xs text-gray-600 leading-relaxed">
                Tippe auf <strong>Teilen</strong> <span className="text-base">⬆️</span> und dann auf{" "}
                <strong>„Zum Startbildschirm"</strong>.
              </p>
            </div>
            <button type="button" onClick={handleDismiss} className="rounded-md p-1 text-gray-400 shrink-0" aria-label="Schließen">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
