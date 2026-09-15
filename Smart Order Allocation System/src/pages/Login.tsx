import { useState } from "react";
import { login } from "../lib/auth";
import { navigate } from "../lib/router";
import type { Role } from "../lib/types";

export default function Login({ onLogin }: { onLogin: (role: Role) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    setTimeout(() => {
      const result = login(email.trim(), password);
      if (result.success && result.session) {
        onLogin(result.session.user.role);
        navigate(result.session.user.role === "admin" ? "/admin" : "/orders/new");
      } else {
        setError(result.error || "Login failed.");
      }
      setLoading(false);
    }, 400);
  }

  function fillDemo(role: "customer" | "admin") {
    setEmail(role === "admin" ? "admin@demo.com" : "customer@demo.com");
    setPassword(role === "admin" ? "admin123" : "customer123");
    setError("");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--background)" }}>
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: "var(--primary)" }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
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
            <span className="font-serif text-xl" style={{ color: "var(--foreground)" }}>SOAS</span>
          </div>
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Smart Order Allocation System</p>
        </div>

        {/* Card */}
        <div className="rounded-lg border p-6" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <h1 className="text-lg font-semibold mb-1" style={{ color: "var(--foreground)" }}>Sign in</h1>
          <p className="text-sm mb-6" style={{ color: "var(--muted-foreground)" }}>Access your account to place or manage orders.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                className="w-full px-3 py-2 text-sm rounded-md border outline-none transition-colors"
                style={{
                  background: "var(--muted)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--ring)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--muted-foreground)" }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3 py-2 text-sm rounded-md border outline-none transition-colors"
                style={{
                  background: "var(--muted)",
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
                onFocus={(e) => (e.target.style.borderColor = "var(--ring)")}
                onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
              />
            </div>

            {error && (
              <div className="text-xs px-3 py-2 rounded-md" style={{ background: "#3d1a1a", color: "#f87171" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-sm font-semibold rounded-md transition-opacity"
              style={{ background: "var(--primary)", color: "var(--primary-foreground)", opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {/* Demo quick-fill */}
          <div className="mt-5 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
            <p className="text-xs mb-2" style={{ color: "var(--muted-foreground)" }}>Demo credentials</p>
            <div className="flex gap-2">
              <button
                onClick={() => fillDemo("customer")}
                className="flex-1 py-1.5 text-xs rounded-md border transition-colors hover:border-orange-400"
                style={{ borderColor: "var(--border)", color: "var(--muted-foreground)", background: "transparent" }}
              >
                Customer
              </button>
              <button
                onClick={() => fillDemo("admin")}
                className="flex-1 py-1.5 text-xs rounded-md border transition-colors hover:border-orange-400"
                style={{ borderColor: "var(--border)", color: "var(--muted-foreground)", background: "transparent" }}
              >
                Admin
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
