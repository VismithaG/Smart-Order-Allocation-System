import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import { query } from "../db/database.js";
import { signToken, authenticateToken, AuthRequest } from "../middleware/auth.js";
import type { User } from "../types.js";

const router = Router();

// POST /api/auth/register
router.post("/register", async (req, res: Response): Promise<void> => {
  try {
    const { name, email, password, city, lat, lng } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ success: false, error: "Name, email, and password are required." });
      return;
    }

    const cleanEmail = String(email).trim().toLowerCase();
    if (!cleanEmail.includes("@")) {
      res.status(400).json({ success: false, error: "Please provide a valid email address." });
      return;
    }

    if (String(password).length < 6) {
      res.status(400).json({ success: false, error: "Password must be at least 6 characters long." });
      return;
    }

    // Check if user exists
    const existingResult = await query("SELECT id FROM users WHERE email = $1", [cleanEmail]);
    if (existingResult.rows.length > 0) {
      res.status(409).json({ success: false, error: "An account with this email already exists." });
      return;
    }

    const userId = `u-${Date.now().toString(36)}`;
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(String(password), salt);

    const userCity = city || "Colombo";
    const userLat = typeof lat === "number" ? lat : 6.9271;
    const userLng = typeof lng === "number" ? lng : 79.8612;

    await query(
      `INSERT INTO users (id, name, email, password_hash, role, city, lat, lng)
       VALUES ($1, $2, $3, $4, 'customer', $5, $6, $7)`,
      [userId, String(name).trim(), cleanEmail, passwordHash, userCity, userLat, userLng]
    );

    const newUser: User = {
      id: userId,
      name: String(name).trim(),
      email: cleanEmail,
      role: "customer",
      city: userCity,
      lat: userLat,
      lng: userLng,
    };

    const token = signToken(newUser);
    res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user: newUser,
    });
  } catch (err: any) {
    console.error("Register error:", err);
    res.status(500).json({ success: false, error: "Registration failed due to an internal error." });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, error: "Email and password are required." });
      return;
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const result = await query(
      `SELECT id, name, email, password_hash, role, city, lat, lng
       FROM users WHERE email = $1`,
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      res.status(401).json({ success: false, error: "Invalid email or password." });
      return;
    }

    const row = result.rows[0];
    const passwordValid = bcrypt.compareSync(String(password), row.password_hash);
    if (!passwordValid) {
      res.status(401).json({ success: false, error: "Invalid email or password." });
      return;
    }

    const user: User = {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      city: row.city,
      lat: Number(row.lat),
      lng: Number(row.lng),
    };

    const token = signToken(user);
    res.json({
      success: true,
      message: "Login successful",
      token,
      user,
    });
  } catch (err: any) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, error: "Login failed due to an internal error." });
  }
});

// GET /api/auth/me
router.get("/me", authenticateToken, (req: AuthRequest, res: Response): void => {
  if (!req.user) {
    res.status(401).json({ success: false, error: "Unauthorized" });
    return;
  }
  res.json({ success: true, user: req.user });
});

export default router;
