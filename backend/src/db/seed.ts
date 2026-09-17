import bcrypt from "bcryptjs";
import { query } from "./database.js";
import { initSchema } from "./schema.js";

export async function seedDatabase(): Promise<void> {
  await initSchema();

  console.log("Seeding PostgreSQL database...");

  // Clear existing data to ensure clean idempotency
  await query(`
    DELETE FROM order_items;
    DELETE FROM orders;
    DELETE FROM branch_stocks;
    DELETE FROM products;
    DELETE FROM branches;
    DELETE FROM users;
  `);

  // 1. Seed Users
  const salt = bcrypt.genSaltSync(10);
  const adminHash = bcrypt.hashSync("admin123", salt);
  const customerHash = bcrypt.hashSync("customer123", salt);

  const users = [
    { id: "u-admin", name: "System Administrator", email: "admin@demo.com", hash: adminHash, role: "admin", city: "Colombo Fort", lat: 6.9344, lng: 79.8428 },
    { id: "u-customer1", name: "Amal Perera", email: "customer@demo.com", hash: customerHash, role: "customer", city: "Colombo 3", lat: 6.8980, lng: 79.8560 },
    { id: "u-customer2", name: "Nimal Silva", email: "nimal@demo.com", hash: customerHash, role: "customer", city: "Kandy City", lat: 7.2906, lng: 80.6337 },
    { id: "u-customer3", name: "Kamala Fernando", email: "kamala@demo.com", hash: customerHash, role: "customer", city: "Galle", lat: 6.0535, lng: 80.2210 },
  ];

  for (const u of users) {
    await query(
      `INSERT INTO users (id, name, email, password_hash, role, city, lat, lng)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [u.id, u.name, u.email, u.hash, u.role, u.city, u.lat, u.lng]
    );
  }

  // 2. Seed Branches
  const branches = [
    { id: "b-colombo", name: "Colombo Fort Branch", city: "Colombo Fort", lat: 6.9344, lng: 79.8428, activeOrders: 4, maxCapacity: 15, isOpen: true },
    { id: "b-kandy", name: "Kandy City Branch", city: "Kandy", lat: 7.2906, lng: 80.6337, activeOrders: 11, maxCapacity: 15, isOpen: true },
    { id: "b-galle", name: "Galle Harbour Branch", city: "Galle", lat: 6.0535, lng: 80.2210, activeOrders: 2, maxCapacity: 15, isOpen: true },
    { id: "b-negombo", name: "Negombo Beach Branch", city: "Negombo", lat: 7.2088, lng: 79.8358, activeOrders: 8, maxCapacity: 12, isOpen: false },
  ];

  for (const b of branches) {
    await query(
      `INSERT INTO branches (id, name, city, lat, lng, active_orders, max_capacity, is_open)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [b.id, b.name, b.city, b.lat, b.lng, b.activeOrders, b.maxCapacity, b.isOpen]
    );
  }

  // 3. Seed Products (with verified LKR pricing)
  const products = [
    { id: "p1", name: "Classic Milk Tea", category: "Drinks", price: 400 },
    { id: "p2", name: "Brown Sugar Milk Tea", category: "Drinks", price: 600 },
    { id: "p3", name: "Chocolate Milk Tea", category: "Drinks", price: 650 },
    { id: "p4", name: "Mango Fruit Tea", category: "Drinks", price: 600 },
    { id: "p5", name: "Taro Milk Tea", category: "Drinks", price: 650 },
    { id: "p6", name: "Matcha Latte", category: "Drinks", price: 700 },
    { id: "p7", name: "Pearl Add-on", category: "Add-ons", price: 200 },
    { id: "p8", name: "Extra Shot", category: "Add-ons", price: 150 },
  ];

  for (const p of products) {
    await query(
      `INSERT INTO products (id, name, category, price, image_url)
       VALUES ($1, $2, $3, $4, $5)`,
      [p.id, p.name, p.category, p.price, ""]
    );
  }

  // 4. Seed Branch Stocks
  const branchStocks: Record<string, Record<string, number>> = {
    "b-colombo": { p1: 45, p2: 30, p3: 35, p4: 25, p5: 20, p6: 18, p7: 70, p8: 55 },
    "b-kandy":   { p1: 30, p2: 5,  p3: 25, p4: 15, p5: 0,  p6: 8,  p7: 40, p8: 30 },
    "b-galle":   { p1: 50, p2: 40, p3: 40, p4: 35, p5: 30, p6: 22, p7: 80, p8: 60 },
    "b-negombo": { p1: 15, p2: 10, p3: 0,  p4: 0,  p5: 12, p6: 6,  p7: 25, p8: 20 },
  };

  for (const [branchId, stocks] of Object.entries(branchStocks)) {
    for (const [productId, qty] of Object.entries(stocks)) {
      await query(
        `INSERT INTO branch_stocks (branch_id, product_id, quantity)
         VALUES ($1, $2, $3)`,
        [branchId, productId, qty]
      );
    }
  }

  // 5. Seed Historical Orders
  const now = Date.now();
  const seedOrders = [
    {
      id: "ORD-901",
      customerId: "u-customer1",
      customerName: "Amal Perera",
      city: "Colombo 3",
      lat: 6.8980,
      lng: 79.8560,
      total: 1000.00,
      status: "delivered",
      branchId: "b-colombo",
      score: 92,
      breakdown: { stockScore: 100, proximityScore: 98, workloadScore: 73, distanceKm: 4.3, capacityUtilization: 27 },
      reason: "Full stock availability, 4 km away, 27% capacity used.",
      note: "Please deliver before 4 PM thank you!",
      aiCategory: "Delivery Issue",
      aiConfidence: 0.82,
      createdAt: new Date(now - 86400000 * 2).toISOString(),
      items: [
        { id: "oi-1", productId: "p1", productName: "Classic Milk Tea", quantity: 2, unitPrice: 400.00, subtotal: 800.00 },
        { id: "oi-2", productId: "p7", productName: "Pearl Add-on", quantity: 1, unitPrice: 200.00, subtotal: 200.00 },
      ]
    },
    {
      id: "ORD-902",
      customerId: "u-customer1",
      customerName: "Amal Perera",
      city: "Colombo 3",
      lat: 6.8980,
      lng: 79.8560,
      total: 1300.00,
      status: "preparing",
      branchId: "b-colombo",
      score: 89,
      breakdown: { stockScore: 100, proximityScore: 98, workloadScore: 73, distanceKm: 4.3, capacityUtilization: 27 },
      reason: "Full stock availability, 4 km away, 27% capacity used.",
      note: "Please ensure milk tea is cold.",
      aiCategory: "Product/Stock Inquiry",
      aiConfidence: 0.88,
      createdAt: new Date(now - 3600000 * 2).toISOString(),
      items: [
        { id: "oi-3", productId: "p2", productName: "Brown Sugar Milk Tea", quantity: 1, unitPrice: 600.00, subtotal: 600.00 },
        { id: "oi-4", productId: "p6", productName: "Matcha Latte", quantity: 1, unitPrice: 700.00, subtotal: 700.00 },
      ]
    },
    {
      id: "ORD-903",
      customerId: "u-customer2",
      customerName: "Nimal Silva",
      city: "Kandy City",
      lat: 7.2906,
      lng: 80.6337,
      total: 1950.00,
      status: "out_for_delivery",
      branchId: "b-kandy",
      score: 77,
      breakdown: { stockScore: 100, proximityScore: 100, workloadScore: 27, distanceKm: 0.8, capacityUtilization: 73 },
      reason: "Full stock availability, 1 km away, 73% capacity used.",
      note: "Rider please call on arrival.",
      aiCategory: "Delivery Issue",
      aiConfidence: 0.91,
      createdAt: new Date(now - 3600000 * 1).toISOString(),
      items: [
        { id: "oi-5", productId: "p3", productName: "Chocolate Milk Tea", quantity: 3, unitPrice: 650.00, subtotal: 1950.00 }
      ]
    },
    {
      id: "ORD-904",
      customerId: "u-customer3",
      customerName: "Kamala Fernando",
      city: "Galle",
      lat: 6.0535,
      lng: 80.2210,
      total: 1900.00,
      status: "allocated",
      branchId: "b-galle",
      score: 97,
      breakdown: { stockScore: 100, proximityScore: 100, workloadScore: 87, distanceKm: 0.5, capacityUtilization: 13 },
      reason: "Full stock availability, 1 km away, 13% capacity used.",
      note: "Cash on delivery receipt requested.",
      aiCategory: "Payment Issue",
      aiConfidence: 0.85,
      createdAt: new Date(now - 1800000).toISOString(),
      items: [
        { id: "oi-6", productId: "p4", productName: "Mango Fruit Tea", quantity: 2, unitPrice: 600.00, subtotal: 1200.00 },
        { id: "oi-7", productId: "p6", productName: "Matcha Latte", quantity: 1, unitPrice: 700.00, subtotal: 700.00 }
      ]
    },
    {
      id: "ORD-905",
      customerId: "u-customer1",
      customerName: "Amal Perera",
      city: "Negombo",
      lat: 7.2088,
      lng: 79.8358,
      total: 1600.00,
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
        { id: "oi-8", productId: "p1", productName: "Classic Milk Tea", quantity: 4, unitPrice: 400.00, subtotal: 1600.00 }
      ]
    }
  ];

  for (const o of seedOrders) {
    await query(
      `INSERT INTO orders (
        id, customer_id, customer_name, customer_city, customer_lat, customer_lng,
        total_amount, status, allocated_branch_id, allocation_score, allocation_breakdown,
        allocation_reason, customer_note, ai_category, ai_confidence, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
      [
        o.id, o.customerId, o.customerName, o.city, o.lat, o.lng,
        o.total, o.status, o.branchId, o.score, o.breakdown ? JSON.stringify(o.breakdown) : null,
        o.reason, o.note, o.aiCategory, o.aiConfidence, o.createdAt, o.createdAt
      ]
    );

    for (const item of o.items) {
      await query(
        `INSERT INTO order_items (id, order_id, product_id, product_name, quantity, unit_price, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [item.id, o.id, item.productId, item.productName, item.quantity, item.unitPrice, item.subtotal]
      );
    }
  }

  console.log("PostgreSQL database seeded successfully with users, branches, products, stock, and orders.");
}

// Allow direct execution: `tsx src/db/seed.ts`
if (process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js")) {
  seedDatabase()
    .then(() => {
      console.log("Seed complete.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seed failed:", err);
      process.exit(1);
    });
}
