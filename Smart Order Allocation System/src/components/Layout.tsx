import type { ReactNode } from "react";
import { logout } from "../lib/auth";
import { navigate } from "../lib/router";
import type { Route } from "../lib/router";
import type { Role } from "../lib/types";

interface NavItem {
  label: string;
  route: Route;
  icon: ReactNode;
}

const CUSTOMER_NAV: NavItem[] = [
  {
    label: "New Order",
    route: "/orders/new",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="1" y="3" width="13" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M7.5 6v3M6 7.5h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "My Orders",
    route: "/orders",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="1" y="1" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M4 5h7M4 7.5h7M4 10h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
];

const ADMIN_NAV: NavItem[] = [
  {
    label: "Dashboard",
    route: "/admin",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="1" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
        <rect x="8.5" y="1" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
        <rect x="1" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
        <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    ),
  },
  {
    label: "Products",
    route: "/admin/products",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M7.5 1.5l5.5 3v6l-5.5 3-5.5-3v-6l5.5-3z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M7.5 7.5v6M7.5 7.5L13 4.5M7.5 7.5L2 4.5" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    ),
  },
  {
    label: "Branches",
    route: "/admin/branches",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle cx="7.5" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M7.5 8C4.5 8 2 9.8 2 12h11c0-2.2-2.5-4-5.5-4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Customers",
    route: "/admin/users",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M5 6a2 2 0 100-4 2 2 0 000 4zM10 6a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" strokeWidth="1.3" />
        <path d="M1.5 12.5a3.5 3.5 0 017 0M6.5 12.5a3.5 3.5 0 017 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Orders",
    route: "/admin/orders",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="1" y="1" width="13" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
        <path d="M4 5h7M4 7.5h7M4 10h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "AI Classifier",
    route: "/admin/classifier",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
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
  const nav = role === "admin" ? ADMIN_NAV : CUSTOMER_NAV;

  function handleLogout() {
    logout();
    navigate("/login");
    window.location.reload();
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--background)" }}>
      {/* Sidebar */}
      <aside
        className="flex flex-col w-52 shrink-0 border-r"
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
                className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-left text-sm transition-colors"
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
            className="w-full text-xs py-1.5 rounded border transition-colors text-left px-2"
            style={{ borderColor: "var(--border)", color: "var(--muted-foreground)", background: "transparent" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.borderColor = "#f87171"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted-foreground)"; e.currentTarget.style.borderColor = "var(--border)"; }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
