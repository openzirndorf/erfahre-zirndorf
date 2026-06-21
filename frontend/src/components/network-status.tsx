import { WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "./toast-provider";

export function NetworkStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const { showToast } = useToast();

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
      showToast("Du bist wieder online.", "success");
    }
    function handleOffline() {
      setOnline(false);
      showToast("Du bist offline. Check-ins brauchen Internet.", "error");
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [showToast]);

  if (online) return null;

  return (
    <div className="fixed left-0 right-0 z-[70] px-4 oz-network-banner">
      <div className="max-w-[480px] mx-auto rounded-xl bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-lg flex items-center justify-center gap-2">
        <WifiOff className="w-4 h-4" />
        Offline: Check-ins werden erst wieder mit Internet geprüft.
      </div>
    </div>
  );
}
