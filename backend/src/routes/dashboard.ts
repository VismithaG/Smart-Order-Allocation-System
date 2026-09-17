import { Router, Response } from "express";
import { query } from "../db/database.js";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth.js";

const router = Router();

// GET /api/dashboard/stats - Admin Live Dashboard Analytics
router.get("/stats", authenticateToken, requireRole("admin"), async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const totalOrdersRes = await query("SELECT COUNT(*)::int as count FROM orders");
    const totalOrders = totalOrdersRes.rows[0]?.count || 0;

    const activeOrdersRes = await query(`
      SELECT COUNT(*)::int as count FROM orders
      WHERE status IN ('allocated', 'preparing', 'out_for_delivery')
    `);
    const activeOrders = activeOrdersRes.rows[0]?.count || 0;

    const deliveredOrdersRes = await query("SELECT COUNT(*)::int as count FROM orders WHERE status = 'delivered'");
    const deliveredOrders = deliveredOrdersRes.rows[0]?.count || 0;

    const cancelledOrdersRes = await query("SELECT COUNT(*)::int as count FROM orders WHERE status = 'cancelled'");
    const cancelledOrders = cancelledOrdersRes.rows[0]?.count || 0;

    const todayOrdersRes = await query(`
      SELECT COUNT(*)::int as count FROM orders
      WHERE created_at >= CURRENT_DATE
    `);
    const todayOrders = todayOrdersRes.rows[0]?.count || 0;

    const totalRevenueRes = await query(`
      SELECT COALESCE(SUM(total_amount), 0)::numeric as total FROM orders WHERE status = 'delivered'
    `);
    const totalRevenue = Number(totalRevenueRes.rows[0]?.total || 0);

    const avgAllocScoreRes = await query(`
      SELECT ROUND(AVG(allocation_score))::int as avg_score FROM orders WHERE allocation_score IS NOT NULL
    `);
    const avgAllocScore = avgAllocScoreRes.rows[0]?.avg_score || 0;

    const branchRes = await query(`
      SELECT id, name, city, active_orders, max_capacity, is_open
      FROM branches
      ORDER BY name
    `);
    const branchCapacity = branchRes.rows.map((b: any) => ({
      id: b.id,
      name: b.name,
      city: b.city,
      activeOrders: Number(b.active_orders),
      maxCapacity: Number(b.max_capacity),
      isOpen: Boolean(b.is_open),
      utilizationPercent: Math.round((Number(b.active_orders) / Number(b.max_capacity)) * 100),
    }));

    const recentOrdersRes = await query(`
      SELECT o.id, o.customer_name, o.total_amount, o.status, o.created_at, b.name as branch_name
      FROM orders o
      LEFT JOIN branches b ON o.allocated_branch_id = b.id
      ORDER BY o.created_at DESC
      LIMIT 6
    `);
    const recentOrders = recentOrdersRes.rows.map((o: any) => ({
      id: o.id,
      customerName: o.customer_name,
      total: Number(o.total_amount),
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
  } catch (err: any) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({ success: false, error: "Failed to load dashboard statistics." });
  }
});

export default router;
