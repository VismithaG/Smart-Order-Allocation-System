import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import { query } from "../db/database.js";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth.js";
import {
  getMemoryUsers,
  findMemoryUserByEmail,
  findMemoryUserById,
  addMemoryUser,
  updateMemoryUser,
  deleteMemoryUser,
} from "../db/usersStore.js";

const router = Router();

// GET /api/users - Admin list all users with order statistics
router.get("/", authenticateToken, requireRole("admin"), async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await query(`
      SELECT 
        u.id, u.name, u.email, u.role, u.city, u.lat, u.lng, u.created_at,
        COUNT(o.id)::int AS order_count,
        COALESCE(SUM(o.total_amount), 0)::numeric AS total_spent
      FROM users u
      LEFT JOIN orders o ON o.customer_id = u.id
      GROUP BY u.id, u.name, u.email, u.role, u.city, u.lat, u.lng, u.created_at
      ORDER BY u.created_at DESC
    `);

    if (result && result.rows && result.rows.length > 0) {
      const users = result.rows.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        city: u.city,
        lat: Number(u.lat),
        lng: Number(u.lng),
        orderCount: Number(u.order_count),
        totalSpent: Number(Number(u.total_spent).toFixed(2)),
        createdAt: u.created_at,
      }));

      // Synchronize in-memory registry
      users.forEach((u) => addMemoryUser(u as any));
      res.json({ success: true, users: getMemoryUsers() });
      return;
    }

    res.json({ success: true, users: getMemoryUsers() });
  } catch (err: any) {
    console.warn("Database offline during fetch users, returning in-memory users:", err?.message);
    res.json({ success: true, users: getMemoryUsers() });
  }
});

// POST /api/users - Admin create new user/customer/admin
router.post("/", authenticateToken, requireRole("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, email, password, role, city, lat, lng } = req.body;

    if (!name || !email || !password) {
      res.status(400).json({ success: false, error: "Name, email, and password are required." });
      return;
    }

    const cleanEmail = String(email).trim().toLowerCase();
    if (!cleanEmail.includes("@")) {
      res.status(400).json({ success: false, error: "Valid email address required." });
      return;
    }

    if (String(password).length < 6) {
      res.status(400).json({ success: false, error: "Password must be at least 6 characters long." });
      return;
    }

    const targetRole: "admin" | "customer" = role === "admin" ? "admin" : "customer";
    const existingMemory = findMemoryUserByEmail(cleanEmail);
    if (existingMemory) {
      res.status(409).json({ success: false, error: "A user with this email already exists." });
      return;
    }

    const userId = `u-${Date.now().toString(36)}`;
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(String(password), salt);

    const userCity = city || "Colombo";
    const userLat = typeof lat === "number" ? lat : 6.9271;
    const userLng = typeof lng === "number" ? lng : 79.8612;

    const newUserObj = {
      id: userId,
      name: String(name).trim(),
      email: cleanEmail,
      passwordHash,
      role: targetRole,
      city: userCity,
      lat: userLat,
      lng: userLng,
      orderCount: 0,
      totalSpent: 0,
      createdAt: new Date().toISOString(),
    };

    // Always store in memory store first
    addMemoryUser(newUserObj);

    // Attempt database persistence
    try {
      await query(
        `INSERT INTO users (id, name, email, password_hash, role, city, lat, lng)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [userId, String(name).trim(), cleanEmail, passwordHash, targetRole, userCity, userLat, userLng]
      );
    } catch (dbErr: any) {
      console.warn("Database insert failed, user saved in active memory store:", dbErr?.message);
    }

    res.status(201).json({
      success: true,
      message: `${targetRole === "admin" ? "Admin" : "Customer"} user created successfully.`,
      user: {
        id: userId,
        name: String(name).trim(),
        email: cleanEmail,
        role: targetRole,
        city: userCity,
        lat: userLat,
        lng: userLng,
        orderCount: 0,
        totalSpent: 0,
      },
    });
  } catch (err: any) {
    console.error("Create user error:", err);
    res.status(500).json({ success: false, error: "Failed to create user." });
  }
});

// PUT /api/users/:id - Admin update user profile, role, or reset password
router.put("/:id", authenticateToken, requireRole("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { name, email, role, city, lat, lng, password } = req.body;

    const existingMem = findMemoryUserById(id);
    const cleanEmail = email ? String(email).trim().toLowerCase() : existingMem?.email || "";
    const targetRole = role === "admin" ? "admin" : "customer";
    const userCity = city || existingMem?.city || "Colombo";
    const userLat = typeof lat === "number" ? lat : existingMem?.lat || 6.9271;
    const userLng = typeof lng === "number" ? lng : existingMem?.lng || 79.8612;

    const patch: any = {
      name: name ? String(name).trim() : existingMem?.name,
      email: cleanEmail,
      role: targetRole,
      city: userCity,
      lat: userLat,
      lng: userLng,
    };

    if (password && String(password).length >= 6) {
      const salt = bcrypt.genSaltSync(10);
      patch.passwordHash = bcrypt.hashSync(String(password), salt);
    }

    updateMemoryUser(id, patch);

    // Also attempt database update
    try {
      if (patch.passwordHash) {
        await query(
          `UPDATE users
           SET name = $1, email = $2, role = $3, city = $4, lat = $5, lng = $6, password_hash = $7
           WHERE id = $8`,
          [patch.name, cleanEmail, targetRole, userCity, userLat, userLng, patch.passwordHash, id]
        );
      } else {
        await query(
          `UPDATE users
           SET name = $1, email = $2, role = $3, city = $4, lat = $5, lng = $6
           WHERE id = $7`,
          [patch.name, cleanEmail, targetRole, userCity, userLat, userLng, id]
        );
      }
    } catch (dbErr: any) {
      console.warn("Database user update failed, updated in memory store:", dbErr?.message);
    }

    res.json({
      success: true,
      message: "User profile updated successfully.",
      user: {
        id,
        name: patch.name,
        email: cleanEmail,
        role: targetRole,
        city: userCity,
        lat: userLat,
        lng: userLng,
      },
    });
  } catch (err: any) {
    console.error("Update user error:", err);
    res.status(500).json({ success: false, error: "Failed to update user." });
  }
});

// DELETE /api/users/:id - Admin delete user
router.delete("/:id", authenticateToken, requireRole("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const currentUser = req.user!;

    if (currentUser.id === id) {
      res.status(400).json({ success: false, error: "You cannot delete your own admin account." });
      return;
    }

    const existingMem = findMemoryUserById(id);
    deleteMemoryUser(id);

    try {
      await query("DELETE FROM users WHERE id = $1", [id]);
    } catch (dbErr: any) {
      console.warn("Database user delete failed, removed from memory store:", dbErr?.message);
    }

    res.json({
      success: true,
      message: `User '${existingMem?.name || id}' deleted successfully.`,
    });
  } catch (err: any) {
    console.error("Delete user error:", err);
    res.status(500).json({ success: false, error: "Failed to delete user." });
  }
});

export default router;
