import type { User } from "./types";
import { api } from "./api";

const SESSION_KEY = "soas_session";
const JWT_KEY = "soas_jwt";

export interface Session {
  user: User;
  token: string;
  expiresAt: number;
}

export async function login(
  email: string,
  password: string
): Promise<{ success: boolean; session?: Session; error?: string }> {
  try {
    const res = await api.auth.login(email.trim(), password);
    if (res.success && res.token && res.user) {
      const session: Session = {
        user: {
          id: res.user.id,
          name: res.user.name,
          email: res.user.email,
          role: res.user.role,
          location: {
            city: res.user.city || "Colombo",
            lat: res.user.lat || 6.9271,
            lng: res.user.lng || 79.8612,
          },
        },
        token: res.token,
        expiresAt: Date.now() + 8 * 3600 * 1000,
      };

      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      localStorage.setItem(JWT_KEY, res.token);
      return { success: true, session };
    }

    // Fallback for demo users if backend API returns failure
    const cleanEmail = email.trim().toLowerCase();
    if (
      (cleanEmail === "customer@demo.com" && password === "customer123") ||
      (cleanEmail === "admin@demo.com" && password === "admin123")
    ) {
      const role: "admin" | "customer" = cleanEmail.startsWith("admin") ? "admin" : "customer";
      const session: Session = {
        user: {
          id: role === "admin" ? "u-admin" : "u-customer1",
          name: role === "admin" ? "System Administrator" : "Amal Perera",
          email: cleanEmail,
          role,
          location: {
            city: role === "admin" ? "Colombo Fort" : "Colombo 3",
            lat: role === "admin" ? 6.9344 : 6.8980,
            lng: role === "admin" ? 79.8428 : 79.8560,
          },
        },
        token: "demo-fallback-token",
        expiresAt: Date.now() + 8 * 3600 * 1000,
      };

      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      localStorage.setItem(JWT_KEY, session.token);
      return { success: true, session };
    }

    return { success: false, error: (res as any)?.error || "Authentication failed." };
  } catch (err: any) {
    // Fallback for demo users when backend server is offline/unreachable
    const cleanEmail = email.trim().toLowerCase();
    if (
      (cleanEmail === "customer@demo.com" && password === "customer123") ||
      (cleanEmail === "admin@demo.com" && password === "admin123")
    ) {
      const role: "admin" | "customer" = cleanEmail.startsWith("admin") ? "admin" : "customer";
      const session: Session = {
        user: {
          id: role === "admin" ? "u-admin" : "u-customer1",
          name: role === "admin" ? "System Administrator" : "Amal Perera",
          email: cleanEmail,
          role,
          location: {
            city: role === "admin" ? "Colombo Fort" : "Colombo 3",
            lat: role === "admin" ? 6.9344 : 6.8980,
            lng: role === "admin" ? 79.8428 : 79.8560,
          },
        },
        token: "demo-fallback-token",
        expiresAt: Date.now() + 8 * 3600 * 1000,
      };

      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      localStorage.setItem(JWT_KEY, session.token);
      return { success: true, session };
    }

    return { success: false, error: err.message || "Failed to connect to backend server." };
  }
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(JWT_KEY);
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    if (Date.now() > session.expiresAt) {
      logout();
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function isAdmin(): boolean {
  return getSession()?.user.role === "admin";
}
