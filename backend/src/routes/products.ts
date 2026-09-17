import { Router, Response } from "express";
import { query } from "../db/database.js";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth.js";

const router = Router();

// GET /api/products - List all products
router.get("/", async (_req, res: Response): Promise<void> => {
  try {
    const result = await query(`
      SELECT id, name, category, price, image_url, created_at
      FROM products
      ORDER BY category, name
    `);

    const products = result.rows.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: Number(p.price),
      imageUrl: p.image_url,
      createdAt: p.created_at,
    }));

    res.json({ success: true, products });
  } catch (err: any) {
    console.error("Fetch products error:", err);
    res.status(500).json({ success: false, error: "Failed to fetch products." });
  }
});

// POST /api/products - Admin create new product
router.post("/", authenticateToken, requireRole("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, category, price, imageUrl } = req.body;

    if (!name || !category || typeof price !== "number" || price < 0) {
      res.status(400).json({
        success: false,
        error: "Product name, category, and non-negative numeric price are required.",
      });
      return;
    }

    const productId = `p-${Date.now().toString(36)}`;
    const img = imageUrl ? String(imageUrl).trim() : "";

    await query(
      `INSERT INTO products (id, name, category, price, image_url)
       VALUES ($1, $2, $3, $4, $5)`,
      [productId, String(name).trim(), String(category).trim(), price, img]
    );

    // Auto-seed initial stock row (0 quantity) for all existing branches
    await query(
      `INSERT INTO branch_stocks (branch_id, product_id, quantity)
       SELECT id, $1, 0 FROM branches
       ON CONFLICT (branch_id, product_id) DO NOTHING`,
      [productId]
    );

    res.status(201).json({
      success: true,
      message: "Product created successfully.",
      product: {
        id: productId,
        name: String(name).trim(),
        category: String(category).trim(),
        price,
        imageUrl: img,
      },
    });
  } catch (err: any) {
    console.error("Create product error:", err);
    res.status(500).json({ success: false, error: "Failed to create product." });
  }
});

// PUT /api/products/:id - Admin update product
router.put("/:id", authenticateToken, requireRole("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { name, category, price, imageUrl } = req.body;

    if (!name || !category || typeof price !== "number" || price < 0) {
      res.status(400).json({
        success: false,
        error: "Product name, category, and non-negative numeric price are required.",
      });
      return;
    }

    const check = await query("SELECT id FROM products WHERE id = $1", [id]);
    if (check.rows.length === 0) {
      res.status(404).json({ success: false, error: "Product not found." });
      return;
    }

    const img = imageUrl !== undefined ? String(imageUrl).trim() : "";

    await query(
      `UPDATE products
       SET name = $1, category = $2, price = $3, image_url = $4
       WHERE id = $5`,
      [String(name).trim(), String(category).trim(), price, img, id]
    );

    res.json({
      success: true,
      message: "Product updated successfully.",
      product: {
        id,
        name: String(name).trim(),
        category: String(category).trim(),
        price,
        imageUrl: img,
      },
    });
  } catch (err: any) {
    console.error("Update product error:", err);
    res.status(500).json({ success: false, error: "Failed to update product." });
  }
});

// DELETE /api/products/:id - Admin delete product
router.delete("/:id", authenticateToken, requireRole("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);

    const check = await query("SELECT id, name FROM products WHERE id = $1", [id]);
    if (check.rows.length === 0) {
      res.status(404).json({ success: false, error: "Product not found." });
      return;
    }

    // Delete product (branch_stocks cascades automatically per foreign key)
    await query("DELETE FROM products WHERE id = $1", [id]);

    res.json({
      success: true,
      message: `Product '${check.rows[0].name}' deleted successfully.`,
    });
  } catch (err: any) {
    console.error("Delete product error:", err);
    res.status(500).json({ success: false, error: "Failed to delete product." });
  }
});

export default router;
