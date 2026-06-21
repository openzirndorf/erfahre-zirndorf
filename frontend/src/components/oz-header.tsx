import { Bike, HelpCircle, LogIn, Map, Menu, MessageSquarePlus, Shield, Trophy, User, UserPlus, X } from "lucide-react";
import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "../lib/utils";

const navLinks = [
  { href: "/",          label: "Challenges", icon: <Bike className="w-4 h-4" /> },
  { href: "/karte",     label: "Karte",      icon: <Map className="w-4 h-4" /> },
  { href: "/rangliste", label: "Rangliste",  icon: <Trophy className="w-4 h-4" /> },
  { href: "/profil",    label: "Profil",     icon: <User className="w-4 h-4" /> },
  { href: "/faq",       label: "FAQ",        icon: <HelpCircle className="w-4 h-4" /> },
];

function getAuthRole(): string | null {
  try {
    const raw = localStorage.getItem("auth");
    if (!raw) return null;
    return (JSON.parse(raw) as { role?: string }).role ?? null;
  } catch {
    return null;
  }
}

function getNavLinks(role: string | null) {
  const authenticated = role !== null;
  const admin = role?.toLowerCase() === "admin";
  const links = navLinks.map((link) =>
    link.href === "/profil" && !authenticated
      ? { href: "/anmelden", label: "Login", icon: <LogIn className="w-4 h-4" /> }
      : link,
  );
  if (!authenticated) {
    links.push({ href: "/registrieren", label: "Registrieren", icon: <UserPlus className="w-4 h-4" /> });
  }
  if (authenticated) {
    links.push({ href: "/kontakt", label: "Kontakt", icon: <MessageSquarePlus className="w-4 h-4" /> });
  }
  if (admin) {
    links.push({ href: "/admin", label: "Admin", icon: <Shield className="w-4 h-4" /> });
  }
  return links;
}

export function OzHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const role = getAuthRole();
  const headerLinks = getNavLinks(role);

  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    if (href === "/anmelden") return location.pathname === "/anmelden";
    if (href === "/registrieren") return location.pathname === "/registrieren";
    return location.pathname.startsWith(href);
  };

  return (
    <header
      className="sticky top-0 z-50 bg-white border-b border-gray-200"
      style={{ boxShadow: "var(--oz-shadow)", height: "var(--oz-header-height)" }}
    >
      <div className="mx-auto px-4 flex items-center justify-between h-full max-w-[1120px]">
        <Link to="/" className="flex items-center gap-2 no-underline shrink-0 min-w-0">
          <img
            src="/images/maskottchen/kreiselix_plain.webp"
            alt="Kreiselix"
            className="w-9 h-9 object-contain shrink-0"
          />
          <span
            className="text-base font-black leading-none whitespace-nowrap"
            style={{ fontFamily: "var(--oz-font-heading)", color: "var(--oz-brand-green)" }}
          >
            Erfahre Zirndorf
          </span>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          {headerLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                link.href === "/registrieren" && !isActive(link.href)
                  ? "text-white hover:opacity-90"
                  : "",
                isActive(link.href)
                  ? "text-[--oz-brand-green] bg-green-50"
                  : link.href === "/registrieren"
                    ? ""
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100",
              )}
              style={link.href === "/registrieren" && !isActive(link.href) ? { background: "var(--oz-brand-green)" } : undefined}
            >
              {link.icon}
              {link.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          className="lg:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? "Menü schließen" : "Menü öffnen"}
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {menuOpen && (
        <div className="lg:hidden bg-white border-t border-gray-200 px-4 py-3 max-w-[480px] mx-auto">
          <nav className="flex flex-col gap-1">
            {headerLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors",
                  isActive(link.href)
                    ? "bg-green-50 text-[--oz-brand-green]"
                    : "text-gray-700 hover:bg-gray-100",
                )}
              >
                {link.icon}
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

export function OzBottomNav() {
  const location = useLocation();
  const role = getAuthRole();
  const bottomLinks = getNavLinks(role);
  const isActive = (href: string) => {
    if (href === "/") return location.pathname === "/";
    if (href === "/anmelden") return location.pathname === "/anmelden";
    if (href === "/registrieren") return location.pathname === "/registrieren";
    return location.pathname.startsWith(href);
  };

  return (
    <nav className="oz-bottom-nav md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="flex justify-around max-w-[480px] mx-auto">
        {bottomLinks.map((link) => {
          const active = isActive(link.href);
          return (
            <Link
              key={link.href}
              to={link.href}
              className="flex flex-col items-center justify-center gap-0.5 py-2 px-1 text-[10px] font-medium transition-colors flex-1 relative min-w-0"
              style={{ color: active ? "var(--oz-brand-green)" : "#9ca3af" }}
            >
              {active && (
                <span
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full"
                  style={{ background: "var(--oz-brand-green)" }}
                />
              )}
              <span className="w-5 h-5 flex items-center justify-center shrink-0">{link.icon}</span>
              <span className={cn("oz-bottom-nav-label", active ? "font-semibold" : "")}>{link.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
