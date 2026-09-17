import { Router, Response } from "express";
import { query } from "../db/database.js";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth.js";

const router = Router();

// In-memory fallback branches for offline mode
let inMemoryBranches: any[] = [
  {
    id: "b1",
    name: "Colombo Fort Branch",
    city: "Colombo Fort",
    lat: 6.9344,
    lng: 79.8428,
    activeOrders: 4,
    maxCapacity: 15,
    isOpen: true,
    stock: [
      { productId: "p1", productName: "Classic Milk Tea", quantity: 42, price: 400 },
      { productId: "p2", productName: "Brown Sugar Milk Tea", quantity: 28, price: 600 },
      { productId: "p3", productName: "Chocolate Milk Tea", quantity: 35, price: 650 },
      { productId: "p4", productName: "Mango Fruit Tea", quantity: 20, price: 600 },
      { productId: "p5", productName: "Taro Milk Tea", quantity: 18, price: 650 },
      { productId: "p6", productName: "Matcha Latte", quantity: 15, price: 700 },
      { productId: "p7", productName: "Pearl Add-on", quantity: 60, price: 200 },
      { productId: "p8", productName: "Extra Shot", quantity: 50, price: 150 },
    ],
  },
  {
    id: "b2",
    name: "Kandy City Branch",
    city: "Kandy",
    lat: 7.2906,
    lng: 80.6337,
    activeOrders: 11,
    maxCapacity: 15,
    isOpen: true,
    stock: [
      { productId: "p1", productName: "Classic Milk Tea", quantity: 30, price: 400 },
      { productId: "p2", productName: "Brown Sugar Milk Tea", quantity: 5, price: 600 },
      { productId: "p3", productName: "Chocolate Milk Tea", quantity: 22, price: 650 },
      { productId: "p4", productName: "Mango Fruit Tea", quantity: 14, price: 600 },
      { productId: "p5", productName: "Taro Milk Tea", quantity: 0, price: 650 },
      { productId: "p6", productName: "Matcha Latte", quantity: 8, price: 700 },
      { productId: "p7", productName: "Pearl Add-on", quantity: 40, price: 200 },
      { productId: "p8", productName: "Extra Shot", quantity: 30, price: 150 },
    ],
  },
  {
    id: "b3",
    name: "Galle Harbour Branch",
    city: "Galle",
    lat: 6.0535,
    lng: 80.221,
    activeOrders: 2,
    maxCapacity: 15,
    isOpen: true,
    stock: [
      { productId: "p1", productName: "Classic Milk Tea", quantity: 55, price: 400 },
      { productId: "p2", productName: "Brown Sugar Milk Tea", quantity: 40, price: 600 },
      { productId: "p3", productName: "Chocolate Milk Tea", quantity: 38, price: 650 },
      { productId: "p4", productName: "Mango Fruit Tea", quantity: 32, price: 600 },
      { productId: "p5", productName: "Taro Milk Tea", quantity: 25, price: 650 },
      { productId: "p6", productName: "Matcha Latte", quantity: 20, price: 700 },
      { productId: "p7", productName: "Pearl Add-on", quantity: 70, price: 200 },
      { productId: "p8", productName: "Extra Shot", quantity: 60, price: 150 },
    ],
  },
  {
    id: "b4",
    name: "Negombo Beach Branch",
    city: "Negombo",
    lat: 7.2088,
    lng: 79.8358,
    activeOrders: 8,
    maxCapacity: 12,
    isOpen: false,
    stock: [
      { productId: "p1", productName: "Classic Milk Tea", quantity: 18, price: 400 },
      { productId: "p2", productName: "Brown Sugar Milk Tea", quantity: 12, price: 600 },
      { productId: "p3", productName: "Chocolate Milk Tea", quantity: 0, price: 650 },
      { productId: "p4", productName: "Mango Fruit Tea", quantity: 0, price: 600 },
      { productId: "p5", productName: "Taro Milk Tea", quantity: 10, price: 650 },
      { productId: "p6", productName: "Matcha Latte", quantity: 6, price: 700 },
      { productId: "p7", productName: "Pearl Add-on", quantity: 25, price: 200 },
      { productId: "p8", productName: "Extra Shot", quantity: 20, price: 150 },
    ],
  },
];

// GET /api/branches - List all branches with stock details
router.get("/", async (_req, res: Response): Promise<void> => {
  try {
    const branchResult = await query(`
      SELECT id, name, city, lat, lng, active_orders, max_capacity, is_open, created_at
      FROM branches
      ORDER BY name
    `);

    const stockResult = await query(`
      SELECT bs.branch_id, bs.product_id, bs.quantity, p.name AS product_name, p.price
      FROM branch_stocks bs
      JOIN products p ON bs.product_id = p.id
    `);

    const branches = branchResult.rows.map((b) => {
      const stock = stockResult.rows
        .filter((s) => s.branch_id === b.id)
        .map((s) => ({
          productId: s.product_id,
          productName: s.product_name,
          quantity: Number(s.quantity),
          price: Number(s.price),
        }));

      return {
        id: b.id,
        name: b.name,
        city: b.city,
        lat: Number(b.lat),
        lng: Number(b.lng),
        activeOrders: Number(b.active_orders),
        maxCapacity: Number(b.max_capacity),
        isOpen: Boolean(b.is_open),
        stock,
      };
    });

    inMemoryBranches = branches;
    res.json({ success: true, branches });
  } catch (err: any) {
    console.warn("Database offline during fetch branches, using in-memory branches:", err?.message);
    res.json({ success: true, branches: inMemoryBranches });
  }
});

// POST /api/branches - Admin create branch location
router.post("/", authenticateToken, requireRole("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, city, lat, lng, maxCapacity } = req.body;

    if (!name || !city || typeof lat !== "number" || typeof lng !== "number") {
      res.status(400).json({
        success: false,
        error: "Branch name, city, and valid numeric coordinates (lat, lng) are required.",
      });
      return;
    }

    const branchId = `b-${Date.now().toString(36)}`;
    const capacity = typeof maxCapacity === "number" && maxCapacity > 0 ? maxCapacity : 15;

    await query(
      `INSERT INTO branches (id, name, city, lat, lng, active_orders, max_capacity, is_open)
       VALUES ($1, $2, $3, $4, $5, 0, $6, true)`,
      [branchId, String(name).trim(), String(city).trim(), lat, lng, capacity]
    );

    // Auto-seed stock for all existing products with quantity 0
    await query(
      `INSERT INTO branch_stocks (branch_id, product_id, quantity)
       SELECT $1, id, 0 FROM products
       ON CONFLICT (branch_id, product_id) DO NOTHING`,
      [branchId]
    );

    res.status(201).json({
      success: true,
      message: "Branch created successfully.",
      branch: {
        id: branchId,
        name: String(name).trim(),
        city: String(city).trim(),
        lat,
        lng,
        activeOrders: 0,
        maxCapacity: capacity,
        isOpen: true,
      },
    });
  } catch (err: any) {
    console.error("Create branch error:", err);
    res.status(500).json({ success: false, error: "Failed to create branch." });
  }
});

// PUT /api/branches/:id - Admin update branch location details
router.put("/:id", authenticateToken, requireRole("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { name, city, lat, lng, maxCapacity } = req.body;

    if (!name || !city || typeof lat !== "number" || typeof lng !== "number") {
      res.status(400).json({
        success: false,
        error: "Branch name, city, and valid numeric coordinates (lat, lng) are required.",
      });
      return;
    }

    const check = await query("SELECT id FROM branches WHERE id = $1", [id]);
    if (check.rows.length === 0) {
      res.status(404).json({ success: false, error: "Branch not found." });
      return;
    }

    const capacity = typeof maxCapacity === "number" && maxCapacity > 0 ? maxCapacity : 15;

    await query(
      `UPDATE branches
       SET name = $1, city = $2, lat = $3, lng = $4, max_capacity = $5
       WHERE id = $6`,
      [String(name).trim(), String(city).trim(), lat, lng, capacity, id]
    );

    res.json({
      success: true,
      message: "Branch updated successfully.",
      branch: {
        id,
        name: String(name).trim(),
        city: String(city).trim(),
        lat,
        lng,
        maxCapacity: capacity,
      },
    });
  } catch (err: any) {
    console.error("Update branch error:", err);
    res.status(500).json({ success: false, error: "Failed to update branch." });
  }
});

// DELETE /api/branches/:id - Admin delete branch location
router.delete("/:id", authenticateToken, requireRole("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);

    const check = await query("SELECT id, name FROM branches WHERE id = $1", [id]);
    if (check.rows.length === 0) {
      res.status(404).json({ success: false, error: "Branch not found." });
      return;
    }

    // Deleting branch automatically cascades stocks and unlinks orders
    await query("DELETE FROM branches WHERE id = $1", [id]);

    res.json({
      success: true,
      message: `Branch '${check.rows[0].name}' deleted successfully.`,
    });
  } catch (err: any) {
    console.error("Delete branch error:", err);
    res.status(500).json({ success: false, error: "Failed to delete branch." });
  }
});

// GET /api/branches/:id/stock - Stock for single branch
router.get("/:id/stock", authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const branchRes = await query("SELECT id, name, is_open FROM branches WHERE id = $1", [id]);
    if (branchRes.rows.length === 0) {
      res.status(404).json({ success: false, error: "Branch not found." });
      return;
    }

    const stockRes = await query(
      `SELECT bs.product_id, p.name AS product_name, p.category, p.price, bs.quantity, bs.last_restocked_at
       FROM branch_stocks bs
       JOIN products p ON bs.product_id = p.id
       WHERE bs.branch_id = $1
       ORDER BY p.name`,
      [id]
    );

    res.json({
      success: true,
      branch: branchRes.rows[0],
      stock: stockRes.rows.map((s) => ({
        productId: s.product_id,
        productName: s.product_name,
        category: s.category,
        price: Number(s.price),
        quantity: Number(s.quantity),
        lastRestockedAt: s.last_restocked_at,
      })),
    });
  } catch (err: any) {
    console.error("Fetch branch stock error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch branch stock." });
  }
});

// PUT /api/branches/:id/stock - Admin update product stock
router.put("/:id/stock", authenticateToken, requireRole("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { productId, quantity } = req.body;

    if (!productId || typeof quantity !== "number" || quantity < 0) {
      res.status(400).json({ success: false, error: "Valid productId and non-negative quantity required." });
      return;
    }

    const branch = await query("SELECT id FROM branches WHERE id = $1", [id]);
    if (branch.rows.length === 0) {
      res.status(404).json({ success: false, error: "Branch not found." });
      return;
    }

    await query(
      `INSERT INTO branch_stocks (branch_id, product_id, quantity, last_restocked_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (branch_id, product_id) DO UPDATE SET
         quantity = EXCLUDED.quantity,
         last_restocked_at = NOW()`,
      [id, productId, quantity]
    );

    res.json({ success: true, message: "Branch stock updated successfully." });
  } catch (err: any) {
    console.error("Update branch stock error:", err);
    res.status(500).json({ success: false, error: "Failed to update branch stock." });
  }
});

// PATCH /api/branches/:id/toggle - Admin open/close branch
router.patch("/:id/toggle", authenticateToken, requireRole("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const branchRes = await query("SELECT id, is_open FROM branches WHERE id = $1", [id]);
    if (branchRes.rows.length === 0) {
      res.status(404).json({ success: false, error: "Branch not found." });
      return;
    }

    const currentStatus = Boolean(branchRes.rows[0].is_open);
    const newStatus = !currentStatus;

    await query("UPDATE branches SET is_open = $1 WHERE id = $2", [newStatus, id]);

    res.json({
      success: true,
      isOpen: newStatus,
      message: `Branch is now ${newStatus ? "OPEN" : "CLOSED"}.`,
    });
  } catch (err: any) {
    console.error("Toggle branch error:", err);
    res.status(500).json({ success: false, error: "Failed to toggle branch status." });
  }
});

export default router;
