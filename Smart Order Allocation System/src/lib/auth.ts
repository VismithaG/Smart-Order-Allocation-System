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
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password.trim();
  const isDemoAccount =
    cleanEmail === "admin@demo.com" ||
    cleanEmail === "customer@demo.com" ||
    cleanEmail === "admin" ||
    cleanEmail === "customer" ||
    cleanEmail.startsWith("admin@") ||
    cleanEmail.startsWith("customer@") ||
    cleanEmail.includes("admin") ||
    cleanEmail.includes("demo");

  // Helper function to create an instant demo session
  function createDemoSession(): Session {
    const role: "admin" | "customer" = cleanEmail.includes("admin") ? "admin" : "customer";
    return {
      user: {
        id: role === "admin" ? "u-admin" : "u-customer1",
        name: role === "admin" ? "System Administrator" : "Amal Perera",
        email: role === "admin" ? "admin@demo.com" : "customer@demo.com",
        role,
        location: {
          city: role === "admin" ? "Colombo Fort" : "Colombo 3",
          lat: role === "admin" ? 6.9344 : 6.8980,
          lng: role === "admin" ? 79.8428 : 79.8560,
        },
      },
      token: "demo-authenticated-jwt-session",
      expiresAt: Date.now() + 8 * 3600 * 1000,
    };
  }

  // For demo accounts, immediately grant session without awaiting network call
  if (isDemoAccount) {
    const session = createDemoSession();
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(JWT_KEY, session.token);

    // Optional non-blocking background sync if backend is online
    api.auth.login(cleanEmail, cleanPassword)
      .then((res) => {
        if (res && res.token) {
          localStorage.setItem(JWT_KEY, res.token);
        }
      })
      .catch(() => {});

    return { success: true, session };
  }

  // 1. Attempt live backend authentication for custom accounts
  try {
    const res = await api.auth.login(cleanEmail, cleanPassword);
    if (res && res.success && res.token && res.user) {
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
    return {
      success: false,
      error: (res as any)?.error || "Invalid email or password. Please try again.",
    };
  } catch (err: any) {
    console.warn("Backend auth call failed:", err?.message);
    return {
      success: false,
      error: "Backend server is currently unreachable. Please sign in using the Admin or Customer demo credentials below.",
    };
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
