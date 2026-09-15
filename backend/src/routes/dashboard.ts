import { Router, Response } from "express";
import { db } from "../db/database.js";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth.js";

const router = Router();

// GET /api/dashboard/stats - Admin Live Dashboard Analytics
router.get("/stats", authenticateToken, requireRole("admin"), (_req: AuthRequest, res: Response): void => {
  const totalOrders = (db.prepare("SELECT COUNT(*) as count FROM orders").get() as any).count;

  const activeOrders = (db.prepare(`
    SELECT COUNT(*) as count FROM orders
    WHERE status IN ('allocated', 'preparing', 'out_for_delivery')
  `).get() as any).count;

  const deliveredOrders = (db.prepare(`
    SELECT COUNT(*) as count FROM orders WHERE status = 'delivered'
  `).get() as any).count;

  const cancelledOrders = (db.prepare(`
    SELECT COUNT(*) as count FROM orders WHERE status = 'cancelled'
  `).get() as any).count;

  const todayOrders = (db.prepare(`
    SELECT COUNT(*) as count FROM orders
    WHERE DATE(created_at) = DATE('now')
  `).get() as any).count;

  const totalRevenue = (db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE status = 'delivered'
  `).get() as any).total;

  const avgAllocScoreRow = db.prepare(`
    SELECT ROUND(AVG(allocation_score)) as avgScore FROM orders WHERE allocation_score IS NOT NULL
  `).get() as any;
  const avgAllocScore = avgAllocScoreRow?.avgScore || 0;

  const branchCapacity = db.prepare(`
    SELECT id, name, city, active_orders, max_capacity, is_open
    FROM branches
    ORDER BY name
  `).all().map((b: any) => ({
    id: b.id,
    name: b.name,
    city: b.city,
    activeOrders: b.active_orders,
    maxCapacity: b.max_capacity,
    isOpen: Boolean(b.is_open),
    utilizationPercent: Math.round((b.active_orders / b.max_capacity) * 100),
  }));

  const recentOrders = db.prepare(`
    SELECT o.id, o.customer_name, o.total_amount, o.status, o.created_at, b.name as branch_name
    FROM orders o
    LEFT JOIN branches b ON o.allocated_branch_id = b.id
    ORDER BY o.created_at DESC
    LIMIT 6
  `).all().map((o: any) => ({
    id: o.id,
    customerName: o.customer_name,
    total: o.total_amount,
    status: o.status,
    branchName: o.branch_name,
    createdAt: o.created_at,
  }));

  res.json({
    success: true,
    stats: {
      totalOrders,
      activeOrders,
      todayOrders,
      deliveredOrders,
      cancelledOrders,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      avgAllocScore,
      branchCapacity,
      recentOrders,
    },
  });
});

export default router;
