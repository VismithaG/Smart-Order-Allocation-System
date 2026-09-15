import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { Role, User } from "../types.js";

const JWT_SECRET = process.env.JWT_SECRET || "soas-super-secure-secret-key-2026";
const JWT_EXPIRES_IN = "8h";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  city: string;
  lat: number;
  lng: number;
}

export interface AuthRequest extends Request {
  user?: AuthenticatedUser;
}

export function signToken(user: User): string {
  const payload: AuthenticatedUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    city: user.city,
    lat: user.lat,
    lng: user.lng,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function authenticateToken(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

  if (!token) {
    res.status(401).json({ success: false, error: "Access token required. Please log in." });
    return;
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      res.status(403).json({ success: false, error: "Invalid or expired session token." });
      return;
    }
    req.user = decoded as AuthenticatedUser;
    next();
  });
}

export function requireRole(role: Role) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Authentication required." });
      return;
    }
    if (req.user.role !== role) {
      res.status(403).json({
        success: false,
        error: `Forbidden: This operation requires '${role}' privilege. Your current role is '${req.user.role}'.`
      });
      return;
    }
    next();
  };
}

export function optionalAuthenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
  if (!token) {
    return next();
  }
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (!err && decoded) {
      req.user = decoded as AuthenticatedUser;
    }
    next();
  });
}
