import { Router, Response } from "express";
import { query, pool } from "../db/database.js";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth.js";
import { evaluateBranches } from "../services/allocation.js";
import { classifyMessage } from "../services/classifier.js";
import type { Branch, BranchLocation, OrderItem, OrderStatus } from "../types.js";

const router = Router();

// Helper to fetch all branches with current stock from PostgreSQL
async function fetchAllBranchesWithStock(): Promise<Branch[]> {
  const branchResult = await query(`
    SELECT id, name, city, lat, lng, active_orders, max_capacity, is_open
    FROM branches
  `);

  const stockResult = await query(`
    SELECT branch_id, product_id, quantity
    FROM branch_stocks
  `);

  return branchResult.rows.map((b) => ({
    id: b.id,
    name: b.name,
    city: b.city,
    lat: Number(b.lat),
    lng: Number(b.lng),
    activeOrders: Number(b.active_orders),
    maxCapacity: Number(b.max_capacity),
    isOpen: Boolean(b.is_open),
    stock: stockResult.rows
      .filter((s) => s.branch_id === b.id)
      .map((s) => ({ productId: s.product_id, quantity: Number(s.quantity) })),
  }));
}

// POST /api/orders - Smart Order Creation & Auto-Allocation
router.post("/", authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const { items, customerLocation, note } = req.body;
  const user = req.user!;

  // 1. Validation
  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ success: false, error: "Order must contain at least one item." });
    return;
  }

  const orderItems: OrderItem[] = [];
  let totalAmount = 0;

  for (const raw of items) {
    const qty = Number(raw.quantity);
    if (!raw.productId || isNaN(qty) || qty <= 0) {
      res.status(400).json({ success: false, error: "Each item must have a valid productId and quantity > 0." });
      return;
    }

    const prodRes = await query("SELECT id, name, price FROM products WHERE id = $1", [raw.productId]);
    if (prodRes.rows.length === 0) {
      res.status(400).json({ success: false, error: `Product ID '${raw.productId}' not found in catalog.` });
      return;
    }

    const product = prodRes.rows[0];
    const unitPrice = Number(product.price);
    const subtotal = unitPrice * qty;
    totalAmount += subtotal;
    orderItems.push({
      productId: product.id,
      productName: product.name,
      quantity: qty,
      unitPrice,
      subtotal,
    });
  }

  // Location resolution
  const location: BranchLocation = {
    city: customerLocation?.city || user.city || "Colombo",
    lat: typeof customerLocation?.lat === "number" ? customerLocation.lat : user.lat,
    lng: typeof customerLocation?.lng === "number" ? customerLocation.lng : user.lng,
  };

  // 2. AI Classification on Customer Note
  let aiCategory: string | undefined;
  let aiConfidence: number | undefined;
  if (note && typeof note === "string" && note.trim().length > 0) {
    const aiResult = classifyMessage(note);
    aiCategory = aiResult.category;
    aiConfidence = aiResult.confidence;
  }

  // 3. Multi-Factor Smart Allocation Engine
  const branches = await fetchAllBranchesWithStock();
  const { bestAllocation, evaluations } = evaluateBranches(branches, orderItems, location);

  const orderId = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
  const now = new Date().toISOString();

  // 4. Edge Case: No branch could fulfill order
  if (!bestAllocation) {
    await query(
      `INSERT INTO orders (
        id, customer_id, customer_name, customer_city, customer_lat, customer_lng,
        total_amount, status, allocated_branch_id, allocation_score, allocation_breakdown,
        allocation_reason, customer_note, ai_category, ai_confidence, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'cancelled', NULL, NULL, NULL, $8, $9, $10, $11, $12, $13)`,
      [
        orderId, user.id, user.name, location.city, location.lat, location.lng,
        totalAmount, "Order rejected: Insufficient stock or branches over capacity.",
        note || null, aiCategory || null, aiConfidence ?? null, now, now
      ]
    );

    for (const item of orderItems) {
      await query(
        `INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [`oi-${Date.now()}-${Math.random()}`, orderId, item.productId, item.productName, item.quantity, item.unitPrice, item.subtotal ?? (item.unitPrice * item.quantity)]
      );
    }

    res.status(200).json({
      success: false,
      message: "No branch could fulfill your order. All nearby branches have insufficient stock or are at maximum capacity.",
      orderId,
      status: "cancelled",
      evaluations,
    });
    return;
  }

  // 5. Successful Allocation: Atomic PostgreSQL Transaction
  const client = await pool.connect();
  try {
    await client.query("BEGIN;");

    // Insert Order
    await client.query(
      `INSERT INTO orders (
        id, customer_id, customer_name, customer_city, customer_lat, customer_lng,
        total_amount, status, allocated_branch_id, allocation_score, allocation_breakdown,
        allocation_reason, customer_note, ai_category, ai_confidence, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'allocated', $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        orderId, user.id, user.name, location.city, location.lat, location.lng,
        totalAmount, bestAllocation.branchId, bestAllocation.score,
        JSON.stringify(bestAllocation.breakdown), bestAllocation.reason,
        note || null, aiCategory || null, aiConfidence ?? null, now, now
      ]
    );

    // Insert Items and deduct branch stocks
    for (const item of orderItems) {
      await client.query(
        `INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [`oi-${Date.now()}-${Math.random()}`, orderId, item.productId, item.productName, item.quantity, item.unitPrice, item.subtotal ?? (item.unitPrice * item.quantity)]
      );

      await client.query(
        `UPDATE branch_stocks
         SET quantity = quantity - $1
         WHERE branch_id = $2 AND product_id = $3`,
        [item.quantity, bestAllocation.branchId, item.productId]
      );
    }

    // Increment branch active orders
    await client.query(
      `UPDATE branches
       SET active_orders = active_orders + 1
       WHERE id = $1`,
      [bestAllocation.branchId]
    );

    await client.query("COMMIT;");

    res.status(201).json({
      success: true,
      message: `Order successfully placed and automatically routed to ${bestAllocation.branchName}!`,
      order: {
        id: orderId,
        customerId: user.id,
        customerName: user.name,
        location,
        items: orderItems,
        total: totalAmount,
        status: "allocated",
        allocatedBranchId: bestAllocation.branchId,
        allocatedBranchName: bestAllocation.branchName,
        allocationScore: bestAllocation.score,
        allocationReason: bestAllocation.reason,
        allocationBreakdown: bestAllocation.breakdown,
        customerNote: note,
        aiCategory,
        aiConfidence,
        createdAt: now,
      },
      allocation: bestAllocation,
      evaluations,
    });
  } catch (err: any) {
    await client.query("ROLLBACK;");
    console.error("Order allocation transaction failed:", err);
    res.status(500).json({ success: false, error: "Order placement failed due to internal error." });
  } finally {
    client.release();
  }
});

// GET /api/orders - List Orders with Filters & RBAC
router.get("/", authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user!;
    const { status, branchId, search } = req.query;

    let queryText = `
      SELECT o.*, b.name AS allocated_branch_name
      FROM orders o
      LEFT JOIN branches b ON o.allocated_branch_id = b.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    // RBAC: Customer only sees their own orders; Admin sees all
    if (user.role === "customer") {
      queryText += ` AND o.customer_id = $${paramIndex++}`;
      params.push(user.id);
    }

    if (status && status !== "all") {
      queryText += ` AND o.status = $${paramIndex++}`;
      params.push(status);
    }

    if (branchId && branchId !== "all") {
      queryText += ` AND o.allocated_branch_id = $${paramIndex++}`;
      params.push(branchId);
    }

    if (search && typeof search === "string" && search.trim()) {
      queryText += ` AND (o.id ILIKE $${paramIndex} OR o.customer_name ILIKE $${paramIndex} OR o.customer_note ILIKE $${paramIndex})`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    queryText += " ORDER BY o.created_at DESC";

    const ordersRes = await query(queryText, params);
    const orders = ordersRes.rows;

    const orderIds = orders.map((o) => o.id);
    let allItems: any[] = [];
    if (orderIds.length > 0) {
      const itemsRes = await query(
        "SELECT * FROM order_items WHERE order_id = ANY($1::varchar[])",
        [orderIds]
      );
      allItems = itemsRes.rows;
    }

    const formatted = orders.map((o) => {
      let breakdown = null;
      try {
        if (typeof o.allocation_breakdown === "string") {
          breakdown = JSON.parse(o.allocation_breakdown);
        } else if (o.allocation_breakdown) {
          breakdown = o.allocation_breakdown;
        }
      } catch {}

      const items = allItems
        .filter((i) => i.order_id === o.id)
        .map((i) => ({
          productId: i.product_id,
          productName: i.product_name,
          quantity: Number(i.quantity),
          unitPrice: Number(i.unit_price),
          subtotal: Number(i.subtotal),
        }));

      return {
        id: o.id,
        customerId: o.customer_id,
        customerName: o.customer_name,
        customerLocation: {
          city: o.customer_city,
          lat: Number(o.customer_lat),
          lng: Number(o.customer_lng),
        },
        items,
        total: Number(o.total_amount),
        status: o.status,
        allocatedBranchId: o.allocated_branch_id,
        allocatedBranchName: o.allocated_branch_name,
        allocationScore: o.allocation_score ? Number(o.allocation_score) : null,
        allocationReason: o.allocation_reason,
        allocationBreakdown: breakdown,
        customerNote: o.customer_note,
        aiCategory: o.ai_category,
        aiConfidence: o.ai_confidence ? Number(o.ai_confidence) : null,
        createdAt: o.created_at,
        updatedAt: o.updated_at,
      };
    });

    res.json({ success: true, orders: formatted });
  } catch (err: any) {
    console.error("List orders error:", err);
    res.status(500).json({ success: false, error: "Failed to list orders." });
  }
});

// GET /api/orders/:id - Single Order Details
router.get("/:id", authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const user = req.user!;

    const orderRes = await query(
      `SELECT o.*, b.name AS allocated_branch_name
       FROM orders o
       LEFT JOIN branches b ON o.allocated_branch_id = b.id
       WHERE o.id = $1`,
      [id]
    );

    if (orderRes.rows.length === 0) {
      res.status(404).json({ success: false, error: "Order not found." });
      return;
    }

    const order = orderRes.rows[0];

    // RBAC security check
    if (user.role === "customer" && order.customer_id !== user.id) {
      res.status(403).json({ success: false, error: "Access denied: You can only view your own orders." });
      return;
    }

    const itemsRes = await query("SELECT * FROM order_items WHERE order_id = $1", [id]);
    const items = itemsRes.rows.map((i) => ({
      productId: i.product_id,
      productName: i.product_name,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unit_price),
      subtotal: Number(i.subtotal),
    }));

    let breakdown = null;
    try {
      if (typeof order.allocation_breakdown === "string") {
        breakdown = JSON.parse(order.allocation_breakdown);
      } else if (order.allocation_breakdown) {
        breakdown = order.allocation_breakdown;
      }
    } catch {}

    res.json({
      success: true,
      order: {
        id: order.id,
        customerId: order.customer_id,
        customerName: order.customer_name,
        customerLocation: {
          city: order.customer_city,
          lat: Number(order.customer_lat),
          lng: Number(order.customer_lng),
        },
        items,
        total: Number(order.total_amount),
        status: order.status,
        allocatedBranchId: order.allocated_branch_id,
        allocatedBranchName: order.allocated_branch_name,
        allocationScore: order.allocation_score ? Number(order.allocation_score) : null,
        allocationReason: order.allocation_reason,
        allocationBreakdown: breakdown,
        customerNote: order.customer_note,
        aiCategory: order.ai_category,
        aiConfidence: order.ai_confidence ? Number(order.ai_confidence) : null,
        createdAt: order.created_at,
        updatedAt: order.updated_at,
      },
    });
  } catch (err: any) {
    console.error("Get order error:", err);
    res.status(500).json({ success: false, error: "Failed to get order." });
  }
});

// PATCH /api/orders/:id/status - Admin Advance Status
router.patch("/:id/status", authenticateToken, requireRole("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const { status } = req.body;

  const validStatuses: OrderStatus[] = ["pending", "allocated", "preparing", "out_for_delivery", "delivered", "cancelled"];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ success: false, error: "Invalid status value." });
    return;
  }

  const orderRes = await query("SELECT * FROM orders WHERE id = $1", [id]);
  if (orderRes.rows.length === 0) {
    res.status(404).json({ success: false, error: "Order not found." });
    return;
  }

  const order = orderRes.rows[0];
  const oldStatus = order.status;

  const client = await pool.connect();
  try {
    await client.query("BEGIN;");

    await client.query("UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2", [status, id]);

    // If marked delivered, decrement active orders on branch
    if (status === "delivered" && oldStatus !== "delivered" && order.allocated_branch_id) {
      await client.query(
        `UPDATE branches
         SET active_orders = GREATEST(0, active_orders - 1)
         WHERE id = $1`,
        [order.allocated_branch_id]
      );
    }

    await client.query("COMMIT;");
    res.json({ success: true, message: `Order status updated to '${status}'.`, status });
  } catch (err: any) {
    await client.query("ROLLBACK;");
    console.error("Update order status error:", err);
    res.status(500).json({ success: false, error: "Failed to update order status." });
  } finally {
    client.release();
  }
});

// POST /api/orders/:id/cancel - Cancel Order with Inventory & Workload Rollback
router.post("/:id/cancel", authenticateToken, async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const user = req.user!;

  const orderRes = await query("SELECT * FROM orders WHERE id = $1", [id]);
  if (orderRes.rows.length === 0) {
    res.status(404).json({ success: false, error: "Order not found." });
    return;
  }

  const order = orderRes.rows[0];

  // Customers can only cancel their own orders
  if (user.role === "customer" && order.customer_id !== user.id) {
    res.status(403).json({ success: false, error: "Access denied." });
    return;
  }

  if (order.status === "delivered") {
    res.status(400).json({ success: false, error: "Delivered orders cannot be cancelled." });
    return;
  }

  if (order.status === "cancelled") {
    res.status(400).json({ success: false, error: "Order is already cancelled." });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN;");

    // 1. Mark status as cancelled
    await client.query("UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1", [id]);

    // 2. Rollback Stock to Allocated Branch
    if (order.allocated_branch_id) {
      const itemsRes = await client.query("SELECT product_id, quantity FROM order_items WHERE order_id = $1", [id]);
      for (const item of itemsRes.rows) {
        await client.query(
          `UPDATE branch_stocks
           SET quantity = quantity + $1
           WHERE branch_id = $2 AND product_id = $3`,
          [Number(item.quantity), order.allocated_branch_id, item.product_id]
        );
      }

      // 3. Decrement active workload
      await client.query(
        `UPDATE branches
         SET active_orders = GREATEST(0, active_orders - 1)
         WHERE id = $1`,
        [order.allocated_branch_id]
      );
    }

    await client.query("COMMIT;");
    res.json({
      success: true,
      message: "Order successfully cancelled. Reserved inventory and branch workload have been automatically restored.",
      status: "cancelled",
    });
  } catch (err: any) {
    await client.query("ROLLBACK;");
    console.error("Cancel order error:", err);
    res.status(500).json({ success: false, error: "Failed to cancel order." });
  } finally {
    client.release();
  }
});

// POST /api/orders/:id/reassign - Admin Manual Branch Override
router.post("/:id/reassign", authenticateToken, requireRole("admin"), async (req: AuthRequest, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const { newBranchId } = req.body;

  if (!newBranchId) {
    res.status(400).json({ success: false, error: "Target newBranchId is required." });
    return;
  }

  const orderRes = await query("SELECT * FROM orders WHERE id = $1", [id]);
  if (orderRes.rows.length === 0) {
    res.status(404).json({ success: false, error: "Order not found." });
    return;
  }

  const order = orderRes.rows[0];
  const targetBranchRes = await query("SELECT id, name, is_open FROM branches WHERE id = $1", [newBranchId]);
  if (targetBranchRes.rows.length === 0) {
    res.status(404).json({ success: false, error: "Target branch not found." });
    return;
  }

  const targetBranch = targetBranchRes.rows[0];
  const oldBranchId = order.allocated_branch_id;

  const client = await pool.connect();
  try {
    await client.query("BEGIN;");

    const itemsRes = await client.query("SELECT product_id, quantity FROM order_items WHERE order_id = $1", [id]);
    const items = itemsRes.rows;

    // Restore stock and workload on old branch (if any)
    if (oldBranchId) {
      for (const item of items) {
        await client.query(
          `UPDATE branch_stocks
           SET quantity = quantity + $1
           WHERE branch_id = $2 AND product_id = $3`,
          [Number(item.quantity), oldBranchId, item.product_id]
        );
      }
      await client.query(
        "UPDATE branches SET active_orders = GREATEST(0, active_orders - 1) WHERE id = $1",
        [oldBranchId]
      );
    }

    // Deduct stock and increment workload on new branch
    for (const item of items) {
      await client.query(
        `UPDATE branch_stocks
         SET quantity = quantity - $1
         WHERE branch_id = $2 AND product_id = $3`,
        [Number(item.quantity), newBranchId, item.product_id]
      );
    }
    await client.query(
      "UPDATE branches SET active_orders = active_orders + 1 WHERE id = $1",
      [newBranchId]
    );

    // Update order record
    const reason = `Manually reassigned to ${targetBranch.name} by administrator.`;
    await client.query(
      `UPDATE orders
       SET allocated_branch_id = $1, allocation_reason = $2, updated_at = NOW()
       WHERE id = $3`,
      [newBranchId, reason, id]
    );

    await client.query("COMMIT;");
    res.json({
      success: true,
      message: `Order reassigned to ${targetBranch.name}. Stock and workload rebalanced.`,
      allocatedBranchId: newBranchId,
      allocatedBranchName: targetBranch.name,
    });
  } catch (err: any) {
    await client.query("ROLLBACK;");
    console.error("Reassign order error:", err);
    res.status(500).json({ success: false, error: "Failed to reassign order." });
  } finally {
    client.release();
  }
});

export default router;
