import { RefreshCw, X } from "lucide-react";
import React, { useEffect, useState } from "react";
import { registerSW } from "virtual:pwa-register";

export function PwaUpdatePrompt() {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [updateServiceWorker, setUpdateServiceWorker] = useState<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    const update = registerSW({
      onNeedRefresh() {
        setNeedsUpdate(true);
      },
      onRegisteredSW(_scriptUrl: string, registration: ServiceWorkerRegistration | undefined) {
        registration?.update();
      },
    });
    setUpdateServiceWorker(() => update);
  }, []);

  if (!needsUpdate) return null;

  return (
    <div className="fixed left-4 right-4 bottom-[calc(5rem+var(--oz-safe-bottom))] z-[60] mx-auto max-w-[420px] rounded-2xl bg-white p-3 shadow-xl border border-gray-200">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--oz-brand-green-light)" }}>
          <RefreshCw className="w-4 h-4" style={{ color: "var(--oz-brand-green)" }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900">Neue Version verfügbar</p>
          <p className="text-xs text-gray-500">Aktualisieren, um die neuesten Änderungen zu laden.</p>
        </div>
        <button
          type="button"
          onClick={() => updateServiceWorker?.(true)}
          className="rounded-xl px-3 py-2 text-xs font-bold text-white"
          style={{ background: "var(--oz-brand-green)" }}
        >
          Laden
        </button>
        <button type="button" onClick={() => setNeedsUpdate(false)} className="p-1 text-gray-400" aria-label="Ausblenden">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
