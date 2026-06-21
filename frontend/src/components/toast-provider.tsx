import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import React, { createContext, useContext, useMemo, useState } from "react";

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const value = useMemo<ToastContextValue>(() => ({
    showToast(message, kind = "info") {
      const id = Date.now() + Math.random();
      setToasts((current) => [...current, { id, kind, message }].slice(-3));
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 4200);
    },
  }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed left-0 right-0 z-[80] px-4 pointer-events-none oz-toast-stack">
        <div className="max-w-[480px] mx-auto space-y-2">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-2 rounded-xl px-3 py-3 text-sm shadow-lg border ${
                toast.kind === "success"
                  ? "bg-green-50 text-green-800 border-green-100"
                  : toast.kind === "error"
                    ? "bg-red-50 text-red-800 border-red-100"
                    : "bg-white text-gray-800 border-gray-100"
              }`}
            >
              {toast.kind === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : null}
              {toast.kind === "error" ? <XCircle className="w-4 h-4 shrink-0 mt-0.5" /> : null}
              {toast.kind === "info" ? <Info className="w-4 h-4 shrink-0 mt-0.5" /> : null}
              <span className="flex-1">{toast.message}</span>
              <button
                type="button"
                onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}
                className="rounded-md p-0.5 opacity-60 hover:opacity-100"
                aria-label="Meldung schließen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
