import type {
  AuthState,
  Challenge,
  CheckInRequest,
  CheckInResponse,
  UserProgress,
  UserRankEntry,
} from "../types";

const BASE = `${(import.meta as { env?: { VITE_API_BASE_URL?: string } }).env?.VITE_API_BASE_URL ?? ""}/api`;
const BLOCKED_STORAGE_KEY = "blocked-account-message";

function getToken(): string | null {
  const raw = localStorage.getItem("auth");
  if (!raw) return null;
  try {
    return (JSON.parse(raw) as AuthState).token;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  return request(path, options);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...options, headers });
  } catch {
    throw new Error("Netzwerkfehler. Bitte prüfe deine Verbindung und versuche es erneut.");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = Array.isArray(err.detail)
      ? err.detail.map((item: { msg?: string }) => item.msg ?? "Ungültige Eingabe").join(", ")
      : err.detail;
    const message = typeof detail === "string" ? detail : "Unbekannter Fehler";
    if (res.status === 403 && message.toLowerCase().includes("gesperrt")) {
      localStorage.removeItem("auth");
      sessionStorage.setItem(BLOCKED_STORAGE_KEY, message);
      if (window.location.hash !== "#/gesperrt") window.location.hash = "/gesperrt";
    } else if (res.status === 401 && localStorage.getItem("auth")) {
      localStorage.removeItem("auth");
      if (window.location.hash !== "#/anmelden") window.location.hash = "/anmelden";
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Auth
export async function requestMagicLink(
  email: string,
  displayName: string | undefined,
  consent: boolean,
  altcha?: string,
  fairPlay?: boolean,
  referralCode?: string,
): Promise<{ message: string; dev_token?: string; dev_code?: string }> {
  try {
    return await request("/auth/request-magic-link", {
      method: "POST",
      body: JSON.stringify({ email, display_name: displayName ?? null, consent, altcha, fair_play: fairPlay ?? false, referral_code: referralCode ?? null }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const lower = message.toLowerCase();
    if (lower.includes("spam") || lower.includes("altcha") || lower.includes("captcha")) {
      throw new Error("Bitte setze den Haken bei „Bitte kurz bestätigen“.");
    }
    if (lower.includes("unprocessable") || lower.includes("ungültige eingabe")) {
      throw new Error("Die Anmeldung konnte nicht gestartet werden. Bitte prüfe E-Mail und Bestätigung.");
    }
    throw err;
  }
}

export async function verifyMagicLink(token: string): Promise<AuthState> {
  return request("/auth/verify", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

// Challenges
export async function fetchTodayChallenges(): Promise<Challenge[]> {
  return request("/challenges/today");
}

export async function fetchChallenges(): Promise<Challenge[]> {
  return request("/challenges");
}

export async function fetchChallenge(id: number, preview = false): Promise<Challenge> {
  return request(`/challenges/${id}${preview ? "?preview=1" : ""}`);
}

export async function fetchChallengeStats(): Promise<{ total: number; started: number; upcoming: number }> {
  return request("/challenges/stats");
}

// Check-in
export async function submitCheckIn(body: CheckInRequest): Promise<CheckInResponse> {
  return request("/checkins", { method: "POST", body: JSON.stringify(body) });
}

// Ranking
export async function fetchRanking(): Promise<UserRankEntry[]> {
  return request("/ranking");
}

// User
export async function fetchMyProgress(): Promise<UserProgress> {
  return request("/users/me/progress");
}

// Admin
export async function adminFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  return request(`/admin${path}`, options);
}
