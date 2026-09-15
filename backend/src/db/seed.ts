import bcrypt from "bcryptjs";
import { db } from "./database.js";
import { initSchema } from "./schema.js";

export function seedDatabase() {
  initSchema();

  // Clear existing data to ensure clean idempotency
  db.exec(`
    DELETE FROM order_items;
    DELETE FROM orders;
    DELETE FROM branch_stocks;
    DELETE FROM products;
    DELETE FROM branches;
    DELETE FROM users;
  `);

  console.log("Seeding database...");

  // 1. Seed Users
  const salt = bcrypt.genSaltSync(10);
  const adminHash = bcrypt.hashSync("admin123", salt);
  const customerHash = bcrypt.hashSync("customer123", salt);

  const insertUser = db.prepare(`
    INSERT INTO users (id, name, email, password_hash, role, city, lat, lng)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run("u-admin", "System Administrator", "admin@demo.com", adminHash, "admin", "Colombo Fort", 6.9344, 79.8428);
  insertUser.run("u-customer1", "Amal Perera", "customer@demo.com", customerHash, "customer", "Colombo 3", 6.8980, 79.8560);
  insertUser.run("u-customer2", "Nimal Silva", "nimal@demo.com", customerHash, "customer", "Kandy City", 7.2906, 80.6337);
  insertUser.run("u-customer3", "Kamala Fernando", "kamala@demo.com", customerHash, "customer", "Galle", 6.0535, 80.2210);

  // 2. Seed Branches
  const insertBranch = db.prepare(`
    INSERT INTO branches (id, name, city, lat, lng, active_orders, max_capacity, is_open)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertBranch.run("b-colombo", "Colombo Fort Branch", "Colombo Fort", 6.9344, 79.8428, 4, 15, 1);
  insertBranch.run("b-kandy", "Kandy City Branch", "Kandy", 7.2906, 80.6337, 11, 15, 1);
  insertBranch.run("b-galle", "Galle Harbour Branch", "Galle", 6.0535, 80.2210, 2, 15, 1);
  insertBranch.run("b-negombo", "Negombo Beach Branch", "Negombo", 7.2088, 79.8358, 8, 12, 0); // closed for maintenance

  // 3. Seed Products
  const insertProduct = db.prepare(`
    INSERT INTO products (id, name, category, price, image_url)
    VALUES (?, ?, ?, ?, ?)
  `);

  const products = [
    { id: "p1", name: "Classic Milk Tea", category: "Drinks", price: 4.50 },
    { id: "p2", name: "Brown Sugar Milk Tea", category: "Drinks", price: 5.50 },
    { id: "p3", name: "Chocolate Milk Tea", category: "Drinks", price: 5.00 },
    { id: "p4", name: "Mango Fruit Tea", category: "Drinks", price: 5.00 },
    { id: "p5", name: "Taro Milk Tea", category: "Drinks", price: 5.50 },
    { id: "p6", name: "Matcha Latte", category: "Drinks", price: 6.00 },
    { id: "p7", name: "Pearl Add-on", category: "Add-ons", price: 0.75 },
    { id: "p8", name: "Extra Shot", category: "Add-ons", price: 1.00 },
  ];

  for (const p of products) {
    insertProduct.run(p.id, p.name, p.category, p.price, "");
  }

  // 4. Seed Branch Stocks
  const insertStock = db.prepare(`
    INSERT INTO branch_stocks (branch_id, product_id, quantity)
    VALUES (?, ?, ?)
  `);

  const branchStocks: Record<string, Record<string, number>> = {
    "b-colombo": { p1: 45, p2: 30, p3: 35, p4: 25, p5: 20, p6: 18, p7: 70, p8: 55 },
    "b-kandy":   { p1: 30, p2: 5,  p3: 25, p4: 15, p5: 0,  p6: 8,  p7: 40, p8: 30 },
    "b-galle":   { p1: 50, p2: 40, p3: 40, p4: 35, p5: 30, p6: 22, p7: 80, p8: 60 },
    "b-negombo": { p1: 15, p2: 10, p3: 0,  p4: 0,  p5: 12, p6: 6,  p7: 25, p8: 20 },
  };

  for (const [branchId, stocks] of Object.entries(branchStocks)) {
    for (const [productId, qty] of Object.entries(stocks)) {
      insertStock.run(branchId, productId, qty);
    }
  }

  // 5. Seed Historical Orders
  const insertOrder = db.prepare(`
    INSERT INTO orders (
      id, customer_id, customer_name, customer_city, customer_lat, customer_lng,
      total_amount, status, allocated_branch_id, allocation_score, allocation_breakdown,
      allocation_reason, customer_note, ai_category, ai_confidence, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertOrderItem = db.prepare(`
    INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, subtotal)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const now = Date.now();
  const seedOrders = [
    {
      id: "ORD-901",
      customerId: "u-customer1",
      customerName: "Amal Perera",
      city: "Colombo 3",
      lat: 6.8980,
      lng: 79.8560,
      total: 10.50,
      status: "delivered",
      branchId: "b-colombo",
      score: 92,
      breakdown: JSON.stringify({ stockScore: 100, proximityScore: 98, workloadScore: 73, distanceKm: 4.3, capacityUtilization: 27 }),
      reason: "Full stock availability, 4 km away, 27% capacity used.",
      note: "Please deliver before 4 PM thank you!",
      aiCategory: "Delivery Issue",
      aiConfidence: 0.82,
      createdAt: new Date(now - 86400000 * 2).toISOString(),
      items: [
        { id: "oi-1", productId: "p1", productName: "Classic Milk Tea", quantity: 2, unitPrice: 4.50, subtotal: 9.00 },
        { id: "oi-2", productId: "p7", productName: "Pearl Add-on", quantity: 2, unitPrice: 0.75, subtotal: 1.50 },
      ]
    },
    {
      id: "ORD-902",
      customerId: "u-customer1",
      customerName: "Amal Perera",
      city: "Colombo 3",
      lat: 6.8980,
      lng: 79.8560,
      total: 11.50,
      status: "preparing",
      branchId: "b-colombo",
      score: 89,
      breakdown: JSON.stringify({ stockScore: 100, proximityScore: 98, workloadScore: 73, distanceKm: 4.3, capacityUtilization: 27 }),
      reason: "Full stock availability, 4 km away, 27% capacity used.",
      note: "Please ensure milk tea is cold.",
      aiCategory: "Product/Stock Inquiry",
      aiConfidence: 0.88,
      createdAt: new Date(now - 3600000 * 2).toISOString(),
      items: [
        { id: "oi-3", productId: "p2", productName: "Brown Sugar Milk Tea", quantity: 1, unitPrice: 5.50, subtotal: 5.50 },
        { id: "oi-4", productId: "p6", productName: "Matcha Latte", quantity: 1, unitPrice: 6.00, subtotal: 6.00 },
      ]
    },
    {
      id: "ORD-903",
      customerId: "u-customer2",
      customerName: "Nimal Silva",
      city: "Kandy City",
      lat: 7.2906,
      lng: 80.6337,
      total: 15.00,
      status: "out_for_delivery",
      branchId: "b-kandy",
      score: 77,
      breakdown: JSON.stringify({ stockScore: 100, proximityScore: 100, workloadScore: 27, distanceKm: 0.8, capacityUtilization: 73 }),
      reason: "Full stock availability, 1 km away, 73% capacity used.",
      note: "Rider please call on arrival.",
      aiCategory: "Delivery Issue",
      aiConfidence: 0.91,
      createdAt: new Date(now - 3600000 * 1).toISOString(),
      items: [
        { id: "oi-5", productId: "p3", productName: "Chocolate Milk Tea", quantity: 3, unitPrice: 5.00, subtotal: 15.00 }
      ]
    },
    {
      id: "ORD-904",
      customerId: "u-customer3",
      customerName: "Kamala Fernando",
      city: "Galle",
      lat: 6.0535,
      lng: 80.2210,
      total: 16.00,
      status: "allocated",
      branchId: "b-galle",
      score: 97,
      breakdown: JSON.stringify({ stockScore: 100, proximityScore: 100, workloadScore: 87, distanceKm: 0.5, capacityUtilization: 13 }),
      reason: "Full stock availability, 1 km away, 13% capacity used.",
      note: "Cash on delivery receipt requested.",
      aiCategory: "Payment Issue",
      aiConfidence: 0.85,
      createdAt: new Date(now - 1800000).toISOString(),
      items: [
        { id: "oi-6", productId: "p4", productName: "Mango Fruit Tea", quantity: 2, unitPrice: 5.00, subtotal: 10.00 },
        { id: "oi-7", productId: "p6", productName: "Matcha Latte", quantity: 1, unitPrice: 6.00, subtotal: 6.00 }
      ]
    },
    {
      id: "ORD-905",
      customerId: "u-customer1",
      customerName: "Amal Perera",
      city: "Negombo",
      lat: 7.2088,
      lng: 79.8358,
      total: 18.00,
      status: "cancelled",
      branchId: null,
      score: null,
      breakdown: null,
      reason: "No eligible branch with sufficient stock was available.",
      note: "Accidentally placed duplicate order, please cancel.",
      aiCategory: "Refund/Cancellation",
      aiConfidence: 0.94,
      createdAt: new Date(now - 86400000 * 3).toISOString(),
      items: [
        { id: "oi-8", productId: "p1", productName: "Classic Milk Tea", quantity: 4, unitPrice: 4.50, subtotal: 18.00 }
      ]
    }
  ];

  for (const o of seedOrders) {
    insertOrder.run(
      o.id, o.customerId, o.customerName, o.city, o.lat, o.lng,
      o.total, o.status, o.branchId, o.score, o.breakdown,
      o.reason, o.note, o.aiCategory, o.aiConfidence, o.createdAt, o.createdAt
    );

    for (const item of o.items) {
      insertOrderItem.run(item.id, o.id, item.productId, item.productName, item.quantity, item.unitPrice, item.subtotal);
    }
  }

  console.log("Database seeded successfully with users, branches, products, stock, and orders.");
}

// Allow direct execution: `tsx src/db/seed.ts`
if (process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js")) {
  seedDatabase();
}
