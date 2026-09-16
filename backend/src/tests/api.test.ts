process.env.NODE_ENV = "test";
import assert from "node:assert/strict";
import { app } from "../server.js";
import { db } from "../db/database.js";
import { seedDatabase } from "../db/seed.js";
import { classifyMessage } from "../services/classifier.js";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING SOAS FULL-STACK BACKEND & ML TEST SUITE");
  console.log("=================================================");

  // Reset to known clean seed state
  seedDatabase();

  let activeServer: any = null;
  let baseUrl = "http://localhost:5000";

  // Check if dev server is already running on port 5000; if not, spin up test server on 5002
  try {
    const check = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(800) });
    if (!check.ok) throw new Error("offline");
  } catch {
    const TEST_PORT = 5002;
    activeServer = app.listen(TEST_PORT);
    baseUrl = `http://localhost:${TEST_PORT}`;
  }

  // 1. Health Check
  console.log("\n[TEST 1] Health Check Endpoint");
  const healthRes = await fetch(`${baseUrl}/api/health`);
  const healthData = await healthRes.json();
  assert.equal(healthRes.status, 200);
  assert.equal(healthData.status, "healthy");
  console.log("✓ Health Check passed:", healthData.service);

  // 2. Auth: Customer & Admin Login
  console.log("\n[TEST 2] Authentication & JWT Generation");
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "customer@demo.com", password: "customer123" }),
  });
  const loginData = await loginRes.json();
  assert.equal(loginRes.status, 200);
  assert.ok(loginData.token, "JWT token should be returned");
  assert.equal(loginData.user.role, "customer");
  const customerToken = loginData.token;
  console.log("✓ Customer login passed. JWT token received.");

  const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@demo.com", password: "admin123" }),
  });
  const adminData = await adminLoginRes.json();
  assert.equal(adminLoginRes.status, 200);
  assert.equal(adminData.user.role, "admin");
  const adminToken = adminData.token;
  console.log("✓ Admin login passed. Admin JWT token received.");

  // 3. Security & RBAC: Customer trying to access Admin endpoints
  console.log("\n[TEST 3] Security & Role-Based Access Control (RBAC)");
  const rbacRes = await fetch(`${baseUrl}/api/dashboard/stats`, {
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  assert.equal(rbacRes.status, 403, "Customer should be forbidden from accessing admin dashboard");
  console.log("✓ RBAC successfully blocked customer from admin dashboard (403 Forbidden).");

  const unauthRes = await fetch(`${baseUrl}/api/dashboard/stats`);
  assert.equal(unauthRes.status, 401, "Unauthenticated request should return 401 Unauthorized");
  console.log("✓ Unauthenticated request blocked (401 Unauthorized).");

  const adminStatsRes = await fetch(`${baseUrl}/api/dashboard/stats`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(adminStatsRes.status, 200);
  const statsData = await adminStatsRes.json();
  assert.ok(statsData.stats.totalOrders >= 5);
  console.log("✓ Admin access to dashboard granted (200 OK). Total orders:", statsData.stats.totalOrders);

  // 4. Products & Branches
  console.log("\n[TEST 4] Products Catalog & Branches");
  const prodRes = await fetch(`${baseUrl}/api/products`);
  const prodData = await prodRes.json();
  assert.equal(prodRes.status, 200);
  assert.ok(prodData.products.length >= 8);
  console.log("✓ Products catalog returned", prodData.products.length, "items.");

  const branchRes = await fetch(`${baseUrl}/api/branches`);
  const branchData = await branchRes.json();
  assert.equal(branchRes.status, 200);
  assert.equal(branchData.branches.length, 4);
  console.log("✓ 4 branches returned with live inventory.");

  // 5. Smart Order Allocation Test
  console.log("\n[TEST 5] Smart Multi-Factor Order Allocation Engine");
  const colomboStockBefore = (db.prepare("SELECT quantity FROM branch_stocks WHERE branch_id = 'b-colombo' AND product_id = 'p1'").get() as any).quantity;
  const colomboWorkloadBefore = (db.prepare("SELECT active_orders FROM branches WHERE id = 'b-colombo'").get() as any).active_orders;

  const orderPayload = {
    items: [
      { productId: "p1", quantity: 2 }, // Classic Milk Tea
      { productId: "p7", quantity: 2 }, // Pearl Add-on
    ],
    customerLocation: { city: "Colombo 3", lat: 6.8980, lng: 79.8560 },
    note: "Please deliver carefully, thank you! Where is my delivery?",
  };

  const orderRes = await fetch(`${baseUrl}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${customerToken}`,
    },
    body: JSON.stringify(orderPayload),
  });
  const orderData = await orderRes.json();
  assert.equal(orderRes.status, 201);
  assert.equal(orderData.success, true);
  assert.equal(orderData.allocation.branchId, "b-colombo", "Should auto-route to Colombo Fort branch");
  assert.ok(orderData.allocation.score > 80, "Allocation score should be high for nearest branch");
  assert.ok(orderData.order.aiCategory, "AI category should be assigned from customer note");

  console.log("✓ Order placed successfully!");
  console.log("  Order ID:", orderData.order.id);
  console.log("  Allocated Branch:", orderData.allocation.branchName);
  console.log("  Allocation Score:", orderData.allocation.score);
  console.log("  Reason:", orderData.allocation.reason);
  console.log("  AI Detected Category:", orderData.order.aiCategory, `(Confidence: ${(orderData.order.aiConfidence * 100).toFixed(1)}%)`);

  // Verify stock deduction in SQLite
  const colomboStockAfter = (db.prepare("SELECT quantity FROM branch_stocks WHERE branch_id = 'b-colombo' AND product_id = 'p1'").get() as any).quantity;
  const colomboWorkloadAfter = (db.prepare("SELECT active_orders FROM branches WHERE id = 'b-colombo'").get() as any).active_orders;
  assert.equal(colomboStockAfter, colomboStockBefore - 2, "Stock must be decremented by ordered quantity");
  assert.equal(colomboWorkloadAfter, colomboWorkloadBefore + 1, "Active workload must be incremented by 1");
  console.log("✓ ACID Stock Deduction verified: Stock reduced from", colomboStockBefore, "to", colomboStockAfter);
  console.log("✓ Branch Workload updated: Workload increased from", colomboWorkloadBefore, "to", colomboWorkloadAfter);

  // 6. Order Cancellation & Stock Rollback Test
  console.log("\n[TEST 6] Order Cancellation & Stock/Workload Rollback");
  const cancelRes = await fetch(`${baseUrl}/api/orders/${orderData.order.id}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  const cancelData = await cancelRes.json();
  assert.equal(cancelRes.status, 200);
  assert.equal(cancelData.status, "cancelled");

  const colomboStockRestored = (db.prepare("SELECT quantity FROM branch_stocks WHERE branch_id = 'b-colombo' AND product_id = 'p1'").get() as any).quantity;
  const colomboWorkloadRestored = (db.prepare("SELECT active_orders FROM branches WHERE id = 'b-colombo'").get() as any).active_orders;
  assert.equal(colomboStockRestored, colomboStockBefore, "Stock must be fully restored upon cancellation");
  assert.equal(colomboWorkloadRestored, colomboWorkloadBefore, "Workload must be released upon cancellation");
  console.log("✓ Inventory Rollback verified: Stock restored to", colomboStockRestored);
  console.log("✓ Workload Release verified: Workload returned to", colomboWorkloadRestored);

  // 7. AI Customer Inquiry Classifier Tests
  console.log("\n[TEST 7] AI / ML Customer Inquiry Classifier");
  const aiTest1 = classifyMessage("My payment was deducted, but my order is not showing.");
  assert.equal(aiTest1.category, "Payment Issue");
  assert.ok(aiTest1.confidence > 0.85);
  console.log("✓ Test sample 1 (PDF Example): 'My payment was deducted, but my order is not showing.' ->", aiTest1.category, `(${(aiTest1.confidence * 100).toFixed(1)}%)`);

  const aiTest2 = classifyMessage("Is this item available at the Kandy branch today?");
  assert.equal(aiTest2.category, "Product/Stock Inquiry");
  console.log("✓ Test sample 2: 'Is this item available at the Kandy branch today?' ->", aiTest2.category, `(${(aiTest2.confidence * 100).toFixed(1)}%)`);

  const aiTest3 = classifyMessage("The rider has not arrived and tracking is stuck");
  assert.equal(aiTest3.category, "Delivery Issue");
  console.log("✓ Test sample 3: 'The rider has not arrived and tracking is stuck' ->", aiTest3.category, `(${(aiTest3.confidence * 100).toFixed(1)}%)`);

  const aiTest4 = classifyMessage("something completely unrelated and vague");
  assert.ok(aiTest4.lowConfidence, "Low confidence flag must trigger for ambiguous input");
  console.log("✓ Test sample 4 (Ambiguous): Flagged as lowConfidence:", aiTest4.lowConfidence, "-", aiTest4.status);

  console.log("\n=================================================");
  console.log("🎉 ALL 7 INTEGRATION & SECURITY TESTS PASSED 100%!");
  console.log("=================================================\n");

  if (activeServer) activeServer.close();
  process.exit(0);
}

runTests().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
