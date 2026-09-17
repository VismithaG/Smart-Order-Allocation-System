import { Router, Response } from "express";
import { query } from "../db/database.js";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth.js";

const router = Router();

// In-memory fallback dataset for seamless offline operation
let inMemoryProducts = [
  { id: "p1", name: "Classic Milk Tea", category: "Drinks", price: 400, imageUrl: "", createdAt: new Date().toISOString() },
  { id: "p2", name: "Brown Sugar Milk Tea", category: "Drinks", price: 600, imageUrl: "", createdAt: new Date().toISOString() },
  { id: "p3", name: "Chocolate Milk Tea", category: "Drinks", price: 650, imageUrl: "", createdAt: new Date().toISOString() },
  { id: "p4", name: "Mango Fruit Tea", category: "Drinks", price: 600, imageUrl: "", createdAt: new Date().toISOString() },
  { id: "p5", name: "Taro Milk Tea", category: "Drinks", price: 650, imageUrl: "", createdAt: new Date().toISOString() },
  { id: "p6", name: "Matcha Latte", category: "Drinks", price: 700, imageUrl: "", createdAt: new Date().toISOString() },
  { id: "p7", name: "Pearl Add-on", category: "Add-ons", price: 200, imageUrl: "", createdAt: new Date().toISOString() },
  { id: "p8", name: "Extra Shot", category: "Add-ons", price: 150, imageUrl: "", createdAt: new Date().toISOString() },
];

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

    inMemoryProducts = products;
    res.json({ success: true, products });
  } catch (err: any) {
    console.warn("Database offline during fetch products, returning in-memory catalog:", err?.message);
    res.json({ success: true, products: inMemoryProducts });
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
    console.warn("Database offline during create product, using in-memory store:", err?.message);
    const { name, category, price, imageUrl } = req.body;
    const newProd = {
      id: `p-${Date.now().toString(36)}`,
      name: String(name || "").trim(),
      category: String(category || "Drinks").trim(),
      price: Number(price || 0),
      imageUrl: imageUrl ? String(imageUrl).trim() : "",
      createdAt: new Date().toISOString(),
    };
    inMemoryProducts.push(newProd);
    res.status(201).json({
      success: true,
      message: "Product created successfully (in-memory mode).",
      product: newProd,
    });
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
    console.warn("Database offline during update product, updating in-memory store:", err?.message);
    const id = String(req.params.id);
    const { name, category, price, imageUrl } = req.body;
    const idx = inMemoryProducts.findIndex((p) => p.id === id);
    const updated = {
      id,
      name: String(name || "").trim(),
      category: String(category || "").trim(),
      price: Number(price || 0),
      imageUrl: imageUrl ? String(imageUrl).trim() : "",
      createdAt: new Date().toISOString(),
    };
    if (idx !== -1) {
      inMemoryProducts[idx] = updated;
    } else {
      inMemoryProducts.push(updated);
    }
    res.json({
      success: true,
      message: "Product updated successfully (in-memory mode).",
      product: updated,
    });
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
    console.warn("Database offline during delete product, deleting from in-memory store:", err?.message);
    const id = String(req.params.id);
    inMemoryProducts = inMemoryProducts.filter((p) => p.id !== id);
    res.json({
      success: true,
      message: "Product deleted successfully (in-memory mode).",
    });
  }
});

export default router;
