import type { User } from "./types";
import { DEMO_USERS } from "./store";

const SESSION_KEY = "soas_session";

export interface Session {
  user: User;
  token: string;
  expiresAt: number;
}

function generateToken(userId: string): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = btoa(JSON.stringify({ sub: userId, iat: Date.now(), exp: Date.now() + 8 * 3600 * 1000 }));
  const sig = btoa(`${userId}:${Date.now()}`);
  return `${header}.${payload}.${sig}`;
}

function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(16);
}

const DEMO_PASSWORDS: Record<string, string> = {
  "customer@demo.com": hashPassword("customer123"),
  "admin@demo.com": hashPassword("admin123"),
};

export function login(email: string, password: string): { success: boolean; session?: Session; error?: string } {
  const user = DEMO_USERS.find((u) => u.email === email);
  if (!user) return { success: false, error: "No account found with that email." };

  const expectedHash = DEMO_PASSWORDS[email];
  if (!expectedHash || hashPassword(password) !== expectedHash) {
    return { success: false, error: "Incorrect password." };
  }

  const session: Session = {
    user,
    token: generateToken(user.id),
    expiresAt: Date.now() + 8 * 3600 * 1000,
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return { success: true, session };
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function getSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    if (Date.now() > session.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
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
