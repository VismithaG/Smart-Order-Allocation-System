process.env.NODE_ENV = "test";
import assert from "node:assert/strict";
import { app } from "../server.js";
import { query } from "../db/database.js";
import { seedDatabase } from "../db/seed.js";
import { classifyMessage } from "../services/classifier.js";

async function runTests() {
  console.log("=================================================");
  console.log("🧪 RUNNING SOAS POSTGRESQL FULL-STACK & CRUD TEST SUITE");
  console.log("=================================================");

  // Reset to known clean seed state
  await seedDatabase();

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
  assert.equal(healthData.database, "PostgreSQL");
  console.log("✓ Health Check passed:", healthData.service, "(PostgreSQL active)");

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

  // 4. Products Supervisory CRUD
  console.log("\n[TEST 4] Admin Supervisory Product CRUD");
  // 4a. Create product
  const createProdRes = await fetch(`${baseUrl}/api/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: "Super Lychee Fizz",
      category: "Drinks",
      price: 580,
      imageUrl: "",
    }),
  });
  const createProdData = await createProdRes.json();
  assert.equal(createProdRes.status, 201);
  assert.equal(createProdData.product.name, "Super Lychee Fizz");
  const newProdId = createProdData.product.id;
  console.log("✓ Admin created product:", newProdId, "Super Lychee Fizz");

  // Verify stock was auto-seeded with 0 across branches in PostgreSQL
  const stockSeedCheck = await query("SELECT COUNT(*)::int as c FROM branch_stocks WHERE product_id = $1", [newProdId]);
  assert.equal(stockSeedCheck.rows[0].c, 4, "Should seed stock entries across all 4 branches");
  console.log("✓ Product stock entries automatically seeded across branches.");

  // 4b. Update product
  const updateProdRes = await fetch(`${baseUrl}/api/products/${newProdId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: "Super Lychee Fizz (Special)",
      category: "Drinks",
      price: 620,
    }),
  });
  const updateProdData = await updateProdRes.json();
  assert.equal(updateProdRes.status, 200);
  assert.equal(updateProdData.product.price, 620);
  console.log("✓ Admin updated product price to Rs. 620.");

  // 4c. Delete product
  const deleteProdRes = await fetch(`${baseUrl}/api/products/${newProdId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(deleteProdRes.status, 200);
  console.log("✓ Admin deleted product successfully.");

  // 5. Branches Supervisory CRUD
  console.log("\n[TEST 5] Admin Supervisory Branch / Location CRUD");
  const createBranchRes = await fetch(`${baseUrl}/api/branches`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: "Kurunegala Central Branch",
      city: "Kurunegala",
      lat: 7.4863,
      lng: 80.3623,
      maxCapacity: 20,
    }),
  });
  const createBranchData = await createBranchRes.json();
  assert.equal(createBranchRes.status, 201);
  const newBranchId = createBranchData.branch.id;
  console.log("✓ Admin created branch location:", createBranchData.branch.name);

  // Update branch
  const updateBranchRes = await fetch(`${baseUrl}/api/branches/${newBranchId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: "Kurunegala City Hub",
      city: "Kurunegala",
      lat: 7.4863,
      lng: 80.3623,
      maxCapacity: 25,
    }),
  });
  assert.equal(updateBranchRes.status, 200);
  console.log("✓ Admin updated branch details.");

  // Delete branch
  const deleteBranchRes = await fetch(`${baseUrl}/api/branches/${newBranchId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(deleteBranchRes.status, 200);
  console.log("✓ Admin deleted branch location.");

  // 6. Users Supervisory CRUD
  console.log("\n[TEST 6] Admin Supervisory User & Customer Management");
  const usersListRes = await fetch(`${baseUrl}/api/users`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const usersListData = await usersListRes.json();
  assert.equal(usersListRes.status, 200);
  assert.ok(usersListData.users.length >= 4);
  console.log("✓ Admin listed users with order metrics. Total users:", usersListData.users.length);

  // Admin creates user
  const createUserRes = await fetch(`${baseUrl}/api/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: "Kasun Jayasuriya",
      email: "kasun@demo.com",
      password: "password123",
      role: "customer",
      city: "Matara",
      lat: 5.9549,
      lng: 80.5550,
    }),
  });
  const createUserData = await createUserRes.json();
  assert.equal(createUserRes.status, 201);
  const newUserId = createUserData.user.id;
  console.log("✓ Admin created user:", createUserData.user.name, `(${createUserData.user.email})`);

  // Admin updates user
  const updateUserRes = await fetch(`${baseUrl}/api/users/${newUserId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${adminToken}`,
    },
    body: JSON.stringify({
      name: "Kasun Jayasuriya (VIP)",
      role: "customer",
      city: "Matara",
    }),
  });
  assert.equal(updateUserRes.status, 200);
  console.log("✓ Admin updated user profile.");

  // Admin deletes user
  const deleteUserRes = await fetch(`${baseUrl}/api/users/${newUserId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(deleteUserRes.status, 200);
  console.log("✓ Admin deleted user account.");

  // 7. Smart Order Allocation Test with PostgreSQL Transactions
  console.log("\n[TEST 7] Smart Multi-Factor Order Allocation Engine (PostgreSQL)");
  const colomboStockRes1 = await query("SELECT quantity FROM branch_stocks WHERE branch_id = 'b-colombo' AND product_id = 'p1'");
  const colomboStockBefore = Number(colomboStockRes1.rows[0].quantity);

  const colomboWorkloadRes1 = await query("SELECT active_orders FROM branches WHERE id = 'b-colombo'");
  const colomboWorkloadBefore = Number(colomboWorkloadRes1.rows[0].active_orders);

  const orderPayload = {
    items: [
      { productId: "p1", quantity: 2 }, // Classic Milk Tea (Rs. 400)
      { productId: "p7", quantity: 2 }, // Pearl Add-on (Rs. 200)
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

  console.log("✓ Order placed successfully in PostgreSQL!");
  console.log("  Order ID:", orderData.order.id);
  console.log("  Allocated Branch:", orderData.allocation.branchName);
  console.log("  Allocation Score:", orderData.allocation.score);
  console.log("  Reason:", orderData.allocation.reason);
  console.log("  AI Detected Category:", orderData.order.aiCategory, `(Confidence: ${(orderData.order.aiConfidence * 100).toFixed(1)}%)`);

  // Verify stock deduction in PostgreSQL
  const colomboStockRes2 = await query("SELECT quantity FROM branch_stocks WHERE branch_id = 'b-colombo' AND product_id = 'p1'");
  const colomboStockAfter = Number(colomboStockRes2.rows[0].quantity);

  const colomboWorkloadRes2 = await query("SELECT active_orders FROM branches WHERE id = 'b-colombo'");
  const colomboWorkloadAfter = Number(colomboWorkloadRes2.rows[0].active_orders);

  assert.equal(colomboStockAfter, colomboStockBefore - 2, "Stock must be decremented by ordered quantity");
  assert.equal(colomboWorkloadAfter, colomboWorkloadBefore + 1, "Active workload must be incremented by 1");
  console.log("✓ ACID Stock Deduction verified in PostgreSQL:", colomboStockBefore, "->", colomboStockAfter);
  console.log("✓ Branch Workload updated:", colomboWorkloadBefore, "->", colomboWorkloadAfter);

  // 8. Order Cancellation & Stock Rollback Test
  console.log("\n[TEST 8] Order Cancellation & Stock/Workload Rollback (PostgreSQL)");
  const cancelRes = await fetch(`${baseUrl}/api/orders/${orderData.order.id}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${customerToken}` },
  });
  const cancelData = await cancelRes.json();
  assert.equal(cancelRes.status, 200);
  assert.equal(cancelData.status, "cancelled");

  const colomboStockRes3 = await query("SELECT quantity FROM branch_stocks WHERE branch_id = 'b-colombo' AND product_id = 'p1'");
  const colomboStockRestored = Number(colomboStockRes3.rows[0].quantity);

  const colomboWorkloadRes3 = await query("SELECT active_orders FROM branches WHERE id = 'b-colombo'");
  const colomboWorkloadRestored = Number(colomboWorkloadRes3.rows[0].active_orders);

  assert.equal(colomboStockRestored, colomboStockBefore, "Stock must be fully restored upon cancellation");
  assert.equal(colomboWorkloadRestored, colomboWorkloadBefore, "Workload must be released upon cancellation");
  console.log("✓ Inventory Rollback verified: Stock restored to", colomboStockRestored);
  console.log("✓ Workload Release verified: Workload returned to", colomboWorkloadRestored);

  // 9. AI Customer Inquiry Classifier Tests
  console.log("\n[TEST 9] AI / ML Customer Inquiry Classifier");
  const aiTest1 = classifyMessage("My payment was deducted, but my order is not showing.");
  assert.equal(aiTest1.category, "Payment Issue");
  assert.ok(aiTest1.confidence > 0.85);
  console.log("✓ Test sample 1 (PDF Example): 'My payment was deducted...' ->", aiTest1.category, `(${(aiTest1.confidence * 100).toFixed(1)}%)`);

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
  console.log("🎉 ALL 9 INTEGRATION, CRUD & SECURITY TESTS PASSED 100%!");
  console.log("=================================================\n");

  if (activeServer) activeServer.close();
  process.exit(0);
}

runTests().catch((err) => {
  console.error("❌ TEST FAILED:", err);
  process.exit(1);
});
