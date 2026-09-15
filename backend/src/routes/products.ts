import { Router, Response } from "express";
import { db } from "../db/database.js";

const router = Router();

// GET /api/products
router.get("/", (_req, res: Response): void => {
  const products = db.prepare(`
    SELECT id, name, category, price, image_url
    FROM products
    ORDER BY category, name
  `).all();

  res.json({ success: true, products });
});

export default router;
