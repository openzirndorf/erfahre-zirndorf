import React, { Suspense } from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { NetworkStatus } from "./components/network-status";
import { OzBottomNav, OzHeader } from "./components/oz-header";
import { PwaInstallPrompt } from "./components/pwa-install-prompt";
import { PwaUpdatePrompt } from "./components/pwa-update-prompt";
import { ToastProvider } from "./components/toast-provider";
import { HomePage } from "./pages/home-page";

const AdminPage = React.lazy(() => import("./pages/admin-page").then((m) => ({ default: m.AdminPage })));
const BlockedPage = React.lazy(() => import("./pages/blocked-page").then((m) => ({ default: m.BlockedPage })));
const ChallengePage = React.lazy(() => import("./pages/challenge-page").then((m) => ({ default: m.ChallengePage })));
const FaqPage = React.lazy(() => import("./pages/faq-page").then((m) => ({ default: m.FaqPage })));
const FairPlayPage = React.lazy(() => import("./pages/fair-play-page").then((m) => ({ default: m.FairPlayPage })));
const LoginPage = React.lazy(() => import("./pages/login-page").then((m) => ({ default: m.LoginPage })));
const RegisterPage = React.lazy(() => import("./pages/register-page").then((m) => ({ default: m.RegisterPage })));
const MapPage = React.lazy(() => import("./pages/map-page").then((m) => ({ default: m.MapPage })));
const PrivacyPage = React.lazy(() => import("./pages/privacy-page").then((m) => ({ default: m.PrivacyPage })));
const ProfilePage = React.lazy(() => import("./pages/profile-page").then((m) => ({ default: m.ProfilePage })));
const RankingPage = React.lazy(() => import("./pages/ranking-page").then((m) => ({ default: m.RankingPage })));
const TermsPage = React.lazy(() => import("./pages/terms-page").then((m) => ({ default: m.TermsPage })));
const SponsorsPage = React.lazy(() => import("./pages/sponsors-page").then((m) => ({ default: m.SponsorsPage })));
const LicensePage = React.lazy(() => import("./pages/license-page").then((m) => ({ default: m.LicensePage })));
const MeldenPage = React.lazy(() => import("./pages/melden-page").then((m) => ({ default: m.MeldenPage })));

function AdminGuard() {
  try {
    const auth = JSON.parse(localStorage.getItem("auth") ?? "null");
    if (auth?.role === "admin") return <AdminPage />;
  } catch { /* ignore */ }
  return <NotFoundPage />;
}

function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
      <h1
        className="text-6xl font-black text-gray-200"
        style={{ fontFamily: "var(--oz-font-heading)" }}
      >
        404
      </h1>
      <p className="text-xl font-semibold text-gray-700">Seite nicht gefunden</p>
      <a href="/#/" className="text-sm underline" style={{ color: "var(--oz-brand-green)" }}>
        Zur Startseite
      </a>
    </div>
  );
}

function PageFallback() {
  return (
    <div className="max-w-[480px] mx-auto px-4 pt-8 space-y-3">
      <div className="h-8 w-32 rounded-lg bg-gray-200 animate-pulse" />
      <div className="h-28 rounded-2xl bg-white animate-pulse" />
      <div className="h-20 rounded-2xl bg-white animate-pulse" />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <HashRouter>
        <div className="min-h-screen flex flex-col">
          <OzHeader />
          <main className="flex-1">
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/challenge/:id" element={<ChallengePage />} />
                <Route path="/karte" element={<MapPage />} />
                <Route path="/rangliste" element={<RankingPage />} />
                <Route path="/profil" element={<ProfilePage />} />
                <Route path="/anmelden" element={<LoginPage />} />
                <Route path="/registrieren" element={<RegisterPage />} />
                <Route path="/datenschutz" element={<PrivacyPage />} />
                <Route path="/teilnahmebedingungen" element={<TermsPage />} />
                <Route path="/fairplay" element={<FairPlayPage />} />
                <Route path="/faq" element={<FaqPage />} />
                <Route path="/admin" element={<AdminGuard />} />
                <Route path="/sponsoren" element={<SponsorsPage />} />
                <Route path="/lizenz" element={<LicensePage />} />
                <Route path="/melden" element={<MeldenPage />} />
                <Route path="/kontakt" element={<MeldenPage />} />
                <Route path="/gesperrt" element={<BlockedPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          </main>
          <NetworkStatus />
          <PwaInstallPrompt />
          <PwaUpdatePrompt />
          <OzBottomNav />
        </div>
      </HashRouter>
    </ToastProvider>
  );
}
