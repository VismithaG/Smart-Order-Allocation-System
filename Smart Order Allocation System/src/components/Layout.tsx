import { useState } from "react";
import type { ReactNode } from "react";
import { logout } from "../lib/auth";
import { navigate } from "../lib/router";
import type { Route } from "../lib/router";
import type { Role } from "../lib/types";

interface NavItem {
  label: string;
  shortLabel?: string;
  route: Route;
  icon: ReactNode;
}

const CUSTOMER_NAV: NavItem[] = [
  {
    label: "New Order",
    shortLabel: "New Order",
    route: "/orders/new",
    icon: (
      <svg width="17" height="17" viewBox="0 0 15 15" fill="none">
        <rect x="1" y="3" width="13" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M7.5 6v3M6 7.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "My Orders",
    shortLabel: "Orders",
    route: "/orders",
    icon: (
      <svg width="17" height="17" viewBox="0 0 15 15" fill="none">
        <rect x="1" y="1" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M4 5h7M4 7.5h7M4 10h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
];

const ADMIN_NAV: NavItem[] = [
  {
    label: "Dashboard",
    shortLabel: "Overview",
    route: "/admin",
    icon: (
      <svg width="17" height="17" viewBox="0 0 15 15" fill="none">
        <rect x="1" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
        <rect x="8.5" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
        <rect x="1" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
        <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    ),
  },
  {
    label: "Products",
    shortLabel: "Products",
    route: "/admin/products",
    icon: (
      <svg width="17" height="17" viewBox="0 0 15 15" fill="none">
        <path d="M7.5 1.5l5.5 3v6l-5.5 3-5.5-3v-6l5.5-3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M7.5 7.5v6M7.5 7.5L13 4.5M7.5 7.5L2 4.5" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    ),
  },
  {
    label: "Branches",
    shortLabel: "Branches",
    route: "/admin/branches",
    icon: (
      <svg width="17" height="17" viewBox="0 0 15 15" fill="none">
        <circle cx="7.5" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M7.5 8C4.5 8 2 9.8 2 12h11c0-2.2-2.5-4-5.5-4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Customers",
    shortLabel: "Users",
    route: "/admin/users",
    icon: (
      <svg width="17" height="17" viewBox="0 0 15 15" fill="none">
        <path d="M5 6a2 2 0 100-4 2 2 0 000 4zM10 6a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" strokeWidth="1.3" />
        <path d="M1.5 12.5a3.5 3.5 0 017 0M6.5 12.5a3.5 3.5 0 017 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Orders",
    shortLabel: "Orders",
    route: "/admin/orders",
    icon: (
      <svg width="17" height="17" viewBox="0 0 15 15" fill="none">
        <rect x="1" y="1" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M4 5h7M4 7.5h7M4 10h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "AI Classifier",
    shortLabel: "AI Triage",
    route: "/admin/classifier",
    icon: (
      <svg width="17" height="17" viewBox="0 0 15 15" fill="none">
        <path d="M2 13l3.5-8.5L9 9.5 11.5 3 13 13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="7.5" cy="7.5" r="1" fill="currentColor" opacity="0.5" />
      </svg>
    ),
  },
];

export default function Layout({
  children,
  currentRoute,
  role,
  userName,
}: {
  children: ReactNode;
  currentRoute: Route;
  role: Role;
  userName: string;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const nav = role === "admin" ? ADMIN_NAV : CUSTOMER_NAV;

  function handleLogout() {
    logout();
    navigate("/login");
    window.location.reload();
  }

  function handleNavigate(route: Route) {
    navigate(route);
    setDrawerOpen(false);
  }

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden" style={{ background: "var(--background)" }}>
      {/* ------------------------------------------------------------- */}
      {/* MOBILE TOP BAR (visible on < md)                              */}
      {/* ------------------------------------------------------------- */}
      <header
        className="flex md:hidden items-center justify-between px-4 h-14 border-b shrink-0 z-30"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded flex items-center justify-center shrink-0" style={{ background: "var(--primary)" }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3" fill="var(--primary-foreground)" />
              <circle cx="2" cy="5" r="1.5" fill="var(--primary-foreground)" opacity="0.7" />
              <circle cx="14" cy="5" r="1.5" fill="var(--primary-foreground)" opacity="0.7" />
              <circle cx="2" cy="11" r="1.5" fill="var(--primary-foreground)" opacity="0.7" />
              <circle cx="14" cy="11" r="1.5" fill="var(--primary-foreground)" opacity="0.7" />
              <line x1="5" y1="8" x2="2" y2="5" stroke="var(--primary-foreground)" strokeWidth="1" opacity="0.5" />
              <line x1="11" y1="8" x2="14" y2="5" stroke="var(--primary-foreground)" strokeWidth="1" opacity="0.5" />
              <line x1="5" y1="8" x2="2" y2="11" stroke="var(--primary-foreground)" strokeWidth="1" opacity="0.5" />
              <line x1="11" y1="8" x2="14" y2="11" stroke="var(--primary-foreground)" strokeWidth="1" opacity="0.5" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-semibold leading-none" style={{ color: "var(--foreground)" }}>SOAS</div>
            <div className="text-[10px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {role === "admin" ? "Admin Panel" : "Customer Portal"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* User initials chip */}
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            title={userName}
          >
            {userName.charAt(0).toUpperCase()}
          </div>

          {/* Drawer Hamburger Toggle */}
          <button
            onClick={() => setDrawerOpen(!drawerOpen)}
            className="p-1.5 rounded-md border text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
            style={{ borderColor: "var(--border)", background: "var(--muted)" }}
            aria-label="Toggle navigation menu"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
              {drawerOpen ? (
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              ) : (
                <path
                  fillRule="evenodd"
                  d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                  clipRule="evenodd"
                />
              )}
            </svg>
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* MOBILE DRAWER OVERLAY & SIDEBAR (visible when open on < md)   */}
      {/* ------------------------------------------------------------- */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <div
        className={`fixed top-14 bottom-0 left-0 w-64 z-50 border-r flex flex-col transition-transform duration-200 ease-in-out md:hidden ${
          drawerOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        <div className="p-3 border-b flex items-center gap-2.5" style={{ borderColor: "var(--border)" }}>
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>{userName}</div>
            <div
              className="text-[10px] uppercase tracking-wide font-mono"
              style={{ color: role === "admin" ? "var(--primary)" : "var(--muted-foreground)" }}
            >
              {role}
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
          {nav.map((item) => {
            const active = currentRoute === item.route;
            return (
              <button
                key={item.route}
                onClick={() => handleNavigate(item.route)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm transition-colors"
                style={{
                  background: active ? "var(--muted)" : "transparent",
                  color: active ? "var(--foreground)" : "var(--muted-foreground)",
                  fontWeight: active ? 600 : 400,
                }}
              >
                <span style={{ color: active ? "var(--primary)" : "inherit" }}>{item.icon}</span>
                {item.label}
                {active && (
                  <div className="ml-auto w-1.5 h-4 rounded-full" style={{ background: "var(--primary)" }} />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t" style={{ borderColor: "var(--border)" }}>
          <button
            onClick={handleLogout}
            className="w-full text-xs py-2 rounded-md border transition-colors text-center font-medium"
            style={{ borderColor: "var(--border)", color: "#f87171", background: "rgba(248, 113, 113, 0.08)" }}
          >
            Sign out
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* DESKTOP PERMANENT SIDEBAR (hidden on < md, flex on >= md)     */}
      {/* ------------------------------------------------------------- */}
      <aside
        className="hidden md:flex flex-col w-52 shrink-0 border-r"
        style={{ background: "var(--card)", borderColor: "var(--border)" }}
      >
        {/* Brand */}
        <div className="px-4 py-4 border-b flex items-center gap-2.5" style={{ borderColor: "var(--border)" }}>
          <div className="w-7 h-7 rounded flex items-center justify-center shrink-0" style={{ background: "var(--primary)" }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3" fill="var(--primary-foreground)" />
              <circle cx="2" cy="5" r="1.5" fill="var(--primary-foreground)" opacity="0.7" />
              <circle cx="14" cy="5" r="1.5" fill="var(--primary-foreground)" opacity="0.7" />
              <circle cx="2" cy="11" r="1.5" fill="var(--primary-foreground)" opacity="0.7" />
              <circle cx="14" cy="11" r="1.5" fill="var(--primary-foreground)" opacity="0.7" />
              <line x1="5" y1="8" x2="2" y2="5" stroke="var(--primary-foreground)" strokeWidth="1" opacity="0.5" />
              <line x1="11" y1="8" x2="14" y2="5" stroke="var(--primary-foreground)" strokeWidth="1" opacity="0.5" />
              <line x1="5" y1="8" x2="2" y2="11" stroke="var(--primary-foreground)" strokeWidth="1" opacity="0.5" />
              <line x1="11" y1="8" x2="14" y2="11" stroke="var(--primary-foreground)" strokeWidth="1" opacity="0.5" />
            </svg>
          </div>
          <div>
            <div className="text-xs font-semibold leading-none" style={{ color: "var(--foreground)" }}>SOAS</div>
            <div className="text-[10px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {role === "admin" ? "Admin Panel" : "Customer Portal"}
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {nav.map((item) => {
            const active = currentRoute === item.route;
            return (
              <button
                key={item.route}
                onClick={() => navigate(item.route)}
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-left text-sm transition-colors cursor-pointer"
                style={{
                  background: active ? "var(--muted)" : "transparent",
                  color: active ? "var(--foreground)" : "var(--muted-foreground)",
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = "var(--muted)";
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = "transparent";
                }}
              >
                <span style={{ color: active ? "var(--primary)" : "inherit" }}>{item.icon}</span>
                {item.label}
                {active && (
                  <div className="ml-auto w-1 h-3.5 rounded-full" style={{ background: "var(--primary)" }} />
                )}
              </button>
            );
          })}
        </nav>

        {/* User / Logout */}
        <div className="px-3 py-3 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2.5 mb-2">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
            >
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>{userName}</div>
              <div
                className="text-[10px] uppercase tracking-wide font-mono"
                style={{ color: role === "admin" ? "var(--primary)" : "var(--muted-foreground)" }}
              >
                {role}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-xs py-1.5 rounded border transition-colors text-left px-2 cursor-pointer"
            style={{ borderColor: "var(--border)", color: "var(--muted-foreground)", background: "transparent" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.borderColor = "#f87171"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted-foreground)"; e.currentTarget.style.borderColor = "var(--border)"; }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ------------------------------------------------------------- */}
      {/* MAIN CONTENT CONTAINER                                        */}
      {/* ------------------------------------------------------------- */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {children}
      </main>

      {/* ------------------------------------------------------------- */}
      {/* MOBILE BOTTOM NAVIGATION BAR (sticky, quick access on < md)  */}
      {/* ------------------------------------------------------------- */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 md:hidden border-t flex items-center justify-around px-1 py-1.5 backdrop-blur-lg"
        style={{
          background: "rgba(22, 27, 34, 0.95)",
          borderColor: "var(--border)",
        }}
      >
        {nav.map((item) => {
          const active = currentRoute === item.route;
          return (
            <button
              key={item.route}
              onClick={() => handleNavigate(item.route)}
              className="flex flex-col items-center justify-center py-1 px-2 rounded-lg transition-colors cursor-pointer flex-1 min-w-0"
              style={{
                color: active ? "var(--primary)" : "var(--muted-foreground)",
              }}
            >
              <div className="relative">
                {item.icon}
                {active && (
                  <span
                    className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ background: "var(--primary)" }}
                  />
                )}
              </div>
              <span
                className="text-[10px] mt-1 truncate max-w-full font-medium"
                style={{ color: active ? "var(--foreground)" : "var(--muted-foreground)" }}
              >
                {item.shortLabel || item.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
