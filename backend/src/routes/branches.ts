import { Router, Response } from "express";
import { db } from "../db/database.js";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth.js";

const router = Router();

// GET /api/branches - List all branches with stock details
router.get("/", (_req, res: Response): void => {
  const branchRows = db.prepare(`
    SELECT id, name, city, lat, lng, active_orders, max_capacity, is_open, created_at
    FROM branches
    ORDER BY name
  `).all() as any[];

  const stockRows = db.prepare(`
    SELECT bs.branch_id, bs.product_id, bs.quantity, p.name AS product_name, p.price
    FROM branch_stocks bs
    JOIN products p ON bs.product_id = p.id
  `).all() as any[];

  const branches = branchRows.map((b) => {
    const stock = stockRows
      .filter((s) => s.branch_id === b.id)
      .map((s) => ({
        productId: s.product_id,
        productName: s.product_name,
        quantity: s.quantity,
        price: s.price,
      }));

    return {
      id: b.id,
      name: b.name,
      city: b.city,
      lat: b.lat,
      lng: b.lng,
      activeOrders: b.active_orders,
      maxCapacity: b.max_capacity,
      isOpen: Boolean(b.is_open),
      stock,
    };
  });

  res.json({ success: true, branches });
});

// GET /api/branches/:id/stock - Stock for single branch
router.get("/:id/stock", authenticateToken, (req: AuthRequest, res: Response): void => {
  const id = String(req.params.id);
  const branch = db.prepare("SELECT id, name, is_open FROM branches WHERE id = ?").get(id);
  if (!branch) {
    res.status(404).json({ success: false, error: "Branch not found." });
    return;
  }

  const stock = db.prepare(`
    SELECT bs.product_id, p.name AS product_name, p.category, p.price, bs.quantity, bs.last_restocked_at
    FROM branch_stocks bs
    JOIN products p ON bs.product_id = p.id
    WHERE bs.branch_id = ?
    ORDER BY p.name
  `).all(id);

  res.json({ success: true, branch, stock });
});

// PUT /api/branches/:id/stock - Admin update product stock
router.put("/:id/stock", authenticateToken, requireRole("admin"), (req: AuthRequest, res: Response): void => {
  const id = String(req.params.id);
  const { productId, quantity } = req.body;

  if (!productId || typeof quantity !== "number" || quantity < 0) {
    res.status(400).json({ success: false, error: "Valid productId and non-negative quantity required." });
    return;
  }

  const branch = db.prepare("SELECT id FROM branches WHERE id = ?").get(id);
  if (!branch) {
    res.status(404).json({ success: false, error: "Branch not found." });
    return;
  }

  db.prepare(`
    INSERT INTO branch_stocks (branch_id, product_id, quantity, last_restocked_at)
    VALUES (?, ?, ?, DATETIME('now'))
    ON CONFLICT(branch_id, product_id) DO UPDATE SET
      quantity = excluded.quantity,
      last_restocked_at = excluded.last_restocked_at
  `).run(id, productId, quantity);

  res.json({ success: true, message: "Branch stock updated successfully." });
});

// PATCH /api/branches/:id/toggle - Admin open/close branch
router.patch("/:id/toggle", authenticateToken, requireRole("admin"), (req: AuthRequest, res: Response): void => {
  const id = String(req.params.id);
  const branch = db.prepare("SELECT id, is_open FROM branches WHERE id = ?").get(id) as any;
  if (!branch) {
    res.status(404).json({ success: false, error: "Branch not found." });
    return;
  }

  const newStatus = branch.is_open ? 0 : 1;
  db.prepare("UPDATE branches SET is_open = ? WHERE id = ?").run(newStatus, id);

  res.json({
    success: true,
    isOpen: Boolean(newStatus),
    message: `Branch is now ${newStatus ? "OPEN" : "CLOSED"}.`
  });
});

export default router;
