import { Router, Response } from "express";
import { db } from "../db/database.js";
import { authenticateToken, requireRole, AuthRequest } from "../middleware/auth.js";
import { evaluateBranches } from "../services/allocation.js";
import { classifyMessage } from "../services/classifier.js";
import type { Branch, BranchLocation, OrderItem, OrderStatus } from "../types.js";

const router = Router();

// Helper to fetch all branches with current stock
function fetchAllBranchesWithStock(): Branch[] {
  const branchRows = db.prepare(`
    SELECT id, name, city, lat, lng, active_orders, max_capacity, is_open
    FROM branches
  `).all() as any[];

  const stockRows = db.prepare(`
    SELECT branch_id, product_id, quantity
    FROM branch_stocks
  `).all() as any[];

  return branchRows.map((b) => ({
    id: b.id,
    name: b.name,
    city: b.city,
    lat: b.lat,
    lng: b.lng,
    activeOrders: b.active_orders,
    maxCapacity: b.max_capacity,
    isOpen: Boolean(b.is_open),
    stock: stockRows
      .filter((s) => s.branch_id === b.id)
      .map((s) => ({ productId: s.product_id, quantity: s.quantity })),
  }));
}

// POST /api/orders - Smart Order Creation & Auto-Allocation
router.post("/", authenticateToken, (req: AuthRequest, res: Response): void => {
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

    const product = db.prepare("SELECT id, name, price FROM products WHERE id = ?").get(raw.productId) as any;
    if (!product) {
      res.status(400).json({ success: false, error: `Product ID '${raw.productId}' not found in catalog.` });
      return;
    }

    const subtotal = product.price * qty;
    totalAmount += subtotal;
    orderItems.push({
      productId: product.id,
      productName: product.name,
      quantity: qty,
      unitPrice: product.price,
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
  const branches = fetchAllBranchesWithStock();
  const { bestAllocation, evaluations } = evaluateBranches(branches, orderItems, location);

  const orderId = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`;
  const now = new Date().toISOString();

    // 4. Edge Case: No branch could fulfill order
  if (!bestAllocation) {
    db.prepare(`
      INSERT INTO orders (
        id, customer_id, customer_name, customer_city, customer_lat, customer_lng,
        total_amount, status, allocated_branch_id, allocation_score, allocation_breakdown,
        allocation_reason, customer_note, ai_category, ai_confidence, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'cancelled', NULL, NULL, NULL, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId, user.id, user.name, location.city, location.lat, location.lng,
      totalAmount, "Order rejected: Insufficient stock or branches over capacity.",
      note || null, aiCategory || null, aiConfidence ?? null, now, now
    );

    for (const item of orderItems) {
      db.prepare(`
        INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(`oi-${Date.now()}-${Math.random()}`, orderId, item.productId, item.productName, item.quantity, item.unitPrice, item.subtotal ?? (item.unitPrice * item.quantity));
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

  // 5. Successful Allocation: Execute Atomic State Update
  try {
    db.exec("BEGIN TRANSACTION;");

    // Insert Order
    db.prepare(`
      INSERT INTO orders (
        id, customer_id, customer_name, customer_city, customer_lat, customer_lng,
        total_amount, status, allocated_branch_id, allocation_score, allocation_breakdown,
        allocation_reason, customer_note, ai_category, ai_confidence, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'allocated', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      orderId, user.id, user.name, location.city, location.lat, location.lng,
      totalAmount, bestAllocation.branchId, bestAllocation.score,
      JSON.stringify(bestAllocation.breakdown), bestAllocation.reason,
      note || null, aiCategory || null, aiConfidence ?? null, now, now
    );

    // Insert Items
    for (const item of orderItems) {
      db.prepare(`
        INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(`oi-${Date.now()}-${Math.random()}`, orderId, item.productId, item.productName, item.quantity, item.unitPrice, item.subtotal ?? (item.unitPrice * item.quantity));

      // Deduct stock from allocated branch
      db.prepare(`
        UPDATE branch_stocks
        SET quantity = quantity - ?
        WHERE branch_id = ? AND product_id = ?
      `).run(item.quantity, bestAllocation.branchId, item.productId);
    }

    // Increment branch active orders
    db.prepare(`
      UPDATE branches
      SET active_orders = active_orders + 1
      WHERE id = ?
    `).run(bestAllocation.branchId);

    db.exec("COMMIT;");

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
    db.exec("ROLLBACK;");
    console.error("Order allocation transaction failed:", err);
    res.status(500).json({ success: false, error: "Order placement failed due to internal error." });
  }
});

// GET /api/orders - List Orders with Filters & RBAC
router.get("/", authenticateToken, (req: AuthRequest, res: Response): void => {
  const user = req.user!;
  const { status, branchId, search } = req.query;

  let query = `
    SELECT o.*, b.name AS allocated_branch_name
    FROM orders o
    LEFT JOIN branches b ON o.allocated_branch_id = b.id
    WHERE 1=1
  `;
  const params: any[] = [];

  // RBAC: Customer only sees their orders; Admin sees all
  if (user.role === "customer") {
    query += " AND o.customer_id = ?";
    params.push(user.id);
  }

  if (status && status !== "all") {
    query += " AND o.status = ?";
    params.push(status);
  }

  if (branchId && branchId !== "all") {
    query += " AND o.allocated_branch_id = ?";
    params.push(branchId);
  }

  if (search && typeof search === "string" && search.trim()) {
    query += " AND (o.id LIKE ? OR o.customer_name LIKE ? OR o.customer_note LIKE ?)";
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  query += " ORDER BY o.created_at DESC";

  const orders = (db.prepare(query).all as any)(...params) as any[];

  // Fetch items for each order
  const orderIds = orders.map((o) => o.id);
  let allItems: any[] = [];
  if (orderIds.length > 0) {
    const placeholders = orderIds.map(() => "?").join(",");
    allItems = (db.prepare(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`).all as any)(...orderIds);
  }

  const formatted = orders.map((o) => {
    let breakdown = null;
    try {
      if (o.allocation_breakdown) breakdown = JSON.parse(o.allocation_breakdown);
    } catch {}

    const items = allItems
      .filter((i) => i.order_id === o.id)
      .map((i) => ({
        productId: i.product_id,
        productName: i.product_name,
        quantity: i.quantity,
        unitPrice: i.unit_price,
        subtotal: i.subtotal,
      }));

    return {
      id: o.id,
      customerId: o.customer_id,
      customerName: o.customer_name,
      customerLocation: { city: o.customer_city, lat: o.customer_lat, lng: o.customer_lng },
      items,
      total: o.total_amount,
      status: o.status,
      allocatedBranchId: o.allocated_branch_id,
      allocatedBranchName: o.allocated_branch_name,
      allocationScore: o.allocation_score,
      allocationReason: o.allocation_reason,
      allocationBreakdown: breakdown,
      customerNote: o.customer_note,
      aiCategory: o.ai_category,
      aiConfidence: o.ai_confidence,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
    };
  });

  res.json({ success: true, orders: formatted });
});

// GET /api/orders/:id - Single Order Details
router.get("/:id", authenticateToken, (req: AuthRequest, res: Response): void => {
  const id = String(req.params.id);
  const user = req.user!;

  const order = db.prepare(`
    SELECT o.*, b.name AS allocated_branch_name
    FROM orders o
    LEFT JOIN branches b ON o.allocated_branch_id = b.id
    WHERE o.id = ?
  `).get(id) as any;

  if (!order) {
    res.status(404).json({ success: false, error: "Order not found." });
    return;
  }

  // RBAC security check
  if (user.role === "customer" && order.customer_id !== user.id) {
    res.status(403).json({ success: false, error: "Access denied: You can only view your own orders." });
    return;
  }

  const items = db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(id);

  let breakdown = null;
  try {
    if (order.allocation_breakdown) breakdown = JSON.parse(order.allocation_breakdown);
  } catch {}

  res.json({
    success: true,
    order: {
      id: order.id,
      customerId: order.customer_id,
      customerName: order.customer_name,
      customerLocation: { city: order.customer_city, lat: order.customer_lat, lng: order.customer_lng },
      items,
      total: order.total_amount,
      status: order.status,
      allocatedBranchId: order.allocated_branch_id,
      allocatedBranchName: order.allocated_branch_name,
      allocationScore: order.allocation_score,
      allocationReason: order.allocation_reason,
      allocationBreakdown: breakdown,
      customerNote: order.customer_note,
      aiCategory: order.ai_category,
      aiConfidence: order.ai_confidence,
      createdAt: order.created_at,
      updatedAt: order.updated_at,
    },
  });
});

// PATCH /api/orders/:id/status - Admin Advance Status
router.patch("/:id/status", authenticateToken, requireRole("admin"), (req: AuthRequest, res: Response): void => {
  const id = String(req.params.id);
  const { status } = req.body;

  const validStatuses: OrderStatus[] = ["pending", "allocated", "preparing", "out_for_delivery", "delivered", "cancelled"];
  if (!validStatuses.includes(status)) {
    res.status(400).json({ success: false, error: "Invalid status value." });
    return;
  }

  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as any;
  if (!order) {
    res.status(404).json({ success: false, error: "Order not found." });
    return;
  }

  const oldStatus = order.status;
  const now = new Date().toISOString();

  try {
    db.exec("BEGIN TRANSACTION;");

    db.prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?").run(status, now, id);

    // If marked delivered, decrement active orders on branch
    if (status === "delivered" && oldStatus !== "delivered" && order.allocated_branch_id) {
      db.prepare(`
        UPDATE branches
        SET active_orders = MAX(0, active_orders - 1)
        WHERE id = ?
      `).run(order.allocated_branch_id);
    }

    db.exec("COMMIT;");
    res.json({ success: true, message: `Order status updated to '${status}'.`, status });
  } catch (err) {
    db.exec("ROLLBACK;");
    res.status(500).json({ success: false, error: "Failed to update order status." });
  }
});

// POST /api/orders/:id/cancel - Cancel Order with Inventory & Workload Rollback
router.post("/:id/cancel", authenticateToken, (req: AuthRequest, res: Response): void => {
  const id = String(req.params.id);
  const user = req.user!;

  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as any;
  if (!order) {
    res.status(404).json({ success: false, error: "Order not found." });
    return;
  }

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

  const now = new Date().toISOString();

  try {
    db.exec("BEGIN TRANSACTION;");

    // 1. Mark status as cancelled
    db.prepare("UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ?").run(now, id);

    // 2. Rollback Stock to Allocated Branch
    if (order.allocated_branch_id) {
      const items = db.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?").all(id) as any[];
      for (const item of items) {
        db.prepare(`
          UPDATE branch_stocks
          SET quantity = quantity + ?
          WHERE branch_id = ? AND product_id = ?
        `).run(item.quantity, order.allocated_branch_id, item.product_id);
      }

      // 3. Decrement active workload
      db.prepare(`
        UPDATE branches
        SET active_orders = MAX(0, active_orders - 1)
        WHERE id = ?
      `).run(order.allocated_branch_id);
    }

    db.exec("COMMIT;");
    res.json({
      success: true,
      message: "Order successfully cancelled. Reserved inventory and branch workload have been automatically restored.",
      status: "cancelled",
    });
  } catch (err) {
    db.exec("ROLLBACK;");
    res.status(500).json({ success: false, error: "Failed to cancel order." });
  }
});

// POST /api/orders/:id/reassign - Admin Manual Branch Override
router.post("/:id/reassign", authenticateToken, requireRole("admin"), (req: AuthRequest, res: Response): void => {
  const id = String(req.params.id);
  const { newBranchId } = req.body;

  if (!newBranchId) {
    res.status(400).json({ success: false, error: "Target newBranchId is required." });
    return;
  }

  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as any;
  if (!order) {
    res.status(404).json({ success: false, error: "Order not found." });
    return;
  }

  const targetBranch = db.prepare("SELECT id, name, is_open FROM branches WHERE id = ?").get(newBranchId) as any;
  if (!targetBranch) {
    res.status(404).json({ success: false, error: "Target branch not found." });
    return;
  }

  const oldBranchId = order.allocated_branch_id;
  const now = new Date().toISOString();

  try {
    db.exec("BEGIN TRANSACTION;");

    const items = db.prepare("SELECT product_id, quantity FROM order_items WHERE order_id = ?").all(id) as any[];

    // Restore stock and workload on old branch (if any)
    if (oldBranchId) {
      for (const item of items) {
        db.prepare(`
          UPDATE branch_stocks
          SET quantity = quantity + ?
          WHERE branch_id = ? AND product_id = ?
        `).run(item.quantity, oldBranchId, item.product_id);
      }
      db.prepare("UPDATE branches SET active_orders = MAX(0, active_orders - 1) WHERE id = ?").run(oldBranchId);
    }

    // Deduct stock and increment workload on new branch
    for (const item of items) {
      db.prepare(`
        UPDATE branch_stocks
        SET quantity = quantity - ?
        WHERE branch_id = ? AND product_id = ?
      `).run(item.quantity, newBranchId, item.product_id);
    }
    db.prepare("UPDATE branches SET active_orders = active_orders + 1 WHERE id = ?").run(newBranchId);

    // Update order record
    const reason = `Manually reassigned to ${targetBranch.name} by administrator.`;
    db.prepare(`
      UPDATE orders
      SET allocated_branch_id = ?, allocation_reason = ?, updated_at = ?
      WHERE id = ?
    `).run(newBranchId, reason, now, id);

    db.exec("COMMIT;");
    res.json({
      success: true,
      message: `Order reassigned to ${targetBranch.name}. Stock and workload rebalanced.`,
      allocatedBranchId: newBranchId,
      allocatedBranchName: targetBranch.name,
    });
  } catch (err) {
    db.exec("ROLLBACK;");
    res.status(500).json({ success: false, error: "Failed to reassign order." });
  }
});

export default router;
