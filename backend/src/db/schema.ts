import { db } from "./database.js";

export function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('customer', 'admin')),
      city TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
    );

    CREATE TABLE IF NOT EXISTS branches (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      active_orders INTEGER NOT NULL DEFAULT 0,
      max_capacity INTEGER NOT NULL DEFAULT 15,
      is_open INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price REAL NOT NULL,
      image_url TEXT
    );

    CREATE TABLE IF NOT EXISTS branch_stocks (
      branch_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      last_restocked_at TEXT NOT NULL DEFAULT (DATETIME('now')),
      PRIMARY KEY (branch_id, product_id),
      FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_city TEXT NOT NULL,
      customer_lat REAL NOT NULL,
      customer_lng REAL NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'allocated', 'preparing', 'out_for_delivery', 'delivered', 'cancelled')),
      allocated_branch_id TEXT,
      allocation_score INTEGER,
      allocation_breakdown TEXT,
      allocation_reason TEXT,
      customer_note TEXT,
      ai_category TEXT,
      ai_confidence REAL,
      created_at TEXT NOT NULL DEFAULT (DATETIME('now')),
      updated_at TEXT NOT NULL DEFAULT (DATETIME('now')),
      FOREIGN KEY (customer_id) REFERENCES users(id),
      FOREIGN KEY (allocated_branch_id) REFERENCES branches(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      subtotal REAL NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(allocated_branch_id);
    CREATE INDEX IF NOT EXISTS idx_branch_stocks_branch ON branch_stocks(branch_id);
  `);
}
