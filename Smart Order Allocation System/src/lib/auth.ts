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
    return { success: false, error: "Authentication failed." };
  } catch (err: any) {
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
