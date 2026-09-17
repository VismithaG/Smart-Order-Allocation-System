import { Router, Response } from "express";
import bcrypt from "bcryptjs";
import { query } from "../db/database.js";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth.js";

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

    res.json({ success: true, users });
  } catch (err: any) {
    console.error("List users error:", err);
    res.status(500).json({ success: false, error: "Failed to list users." });
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

    const targetRole = role === "admin" ? "admin" : "customer";

    const check = await query("SELECT id FROM users WHERE email = $1", [cleanEmail]);
    if (check.rows.length > 0) {
      res.status(409).json({ success: false, error: "A user with this email already exists." });
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
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [userId, String(name).trim(), cleanEmail, passwordHash, targetRole, userCity, userLat, userLng]
    );

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

    const check = await query("SELECT id, email FROM users WHERE id = $1", [id]);
    if (check.rows.length === 0) {
      res.status(404).json({ success: false, error: "User not found." });
      return;
    }

    const cleanEmail = email ? String(email).trim().toLowerCase() : check.rows[0].email;
    if (cleanEmail !== check.rows[0].email) {
      const emailDup = await query("SELECT id FROM users WHERE email = $1 AND id != $2", [cleanEmail, id]);
      if (emailDup.rows.length > 0) {
        res.status(409).json({ success: false, error: "Email is already taken by another account." });
        return;
      }
    }

    const targetRole = role === "admin" ? "admin" : "customer";
    const userCity = city || "Colombo";
    const userLat = typeof lat === "number" ? lat : 6.9271;
    const userLng = typeof lng === "number" ? lng : 79.8612;

    if (password && String(password).length >= 6) {
      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(String(password), salt);
      await query(
        `UPDATE users
         SET name = $1, email = $2, role = $3, city = $4, lat = $5, lng = $6, password_hash = $7
         WHERE id = $8`,
        [String(name).trim(), cleanEmail, targetRole, userCity, userLat, userLng, passwordHash, id]
      );
    } else {
      await query(
        `UPDATE users
         SET name = $1, email = $2, role = $3, city = $4, lat = $5, lng = $6
         WHERE id = $7`,
        [String(name).trim(), cleanEmail, targetRole, userCity, userLat, userLng, id]
      );
    }

    res.json({
      success: true,
      message: "User profile updated successfully.",
      user: {
        id,
        name: String(name).trim(),
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

    const check = await query("SELECT id, name, role FROM users WHERE id = $1", [id]);
    if (check.rows.length === 0) {
      res.status(404).json({ success: false, error: "User not found." });
      return;
    }

    await query("DELETE FROM users WHERE id = $1", [id]);

    res.json({
      success: true,
      message: `User '${check.rows[0].name}' deleted successfully.`,
    });
  } catch (err: any) {
    console.error("Delete user error:", err);
    res.status(500).json({ success: false, error: "Failed to delete user." });
  }
});

export default router;
