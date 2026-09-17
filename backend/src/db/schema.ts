import { pool } from "./database.js";

export async function initSchema(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN;");

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(32) NOT NULL CHECK(role IN ('customer', 'admin')),
        city VARCHAR(128) NOT NULL,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS branches (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        city VARCHAR(128) NOT NULL,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        active_orders INT NOT NULL DEFAULT 0,
        max_capacity INT NOT NULL DEFAULT 15,
        is_open BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(128) NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        image_url TEXT DEFAULT '',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS branch_stocks (
        branch_id VARCHAR(64) NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
        product_id VARCHAR(64) NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        quantity INT NOT NULL DEFAULT 0,
        last_restocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (branch_id, product_id)
      );

      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(64) PRIMARY KEY,
        customer_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
        customer_name VARCHAR(255) NOT NULL,
        customer_city VARCHAR(128) NOT NULL,
        customer_lat DOUBLE PRECISION NOT NULL,
        customer_lng DOUBLE PRECISION NOT NULL,
        total_amount NUMERIC(10, 2) NOT NULL,
        status VARCHAR(64) NOT NULL CHECK(status IN ('pending', 'allocated', 'preparing', 'out_for_delivery', 'delivered', 'cancelled')),
        allocated_branch_id VARCHAR(64) REFERENCES branches(id) ON DELETE SET NULL,
        allocation_score INT,
        allocation_breakdown JSONB,
        allocation_reason TEXT,
        customer_note TEXT,
        ai_category VARCHAR(128),
        ai_confidence NUMERIC(5, 4),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id VARCHAR(64) PRIMARY KEY,
        order_id VARCHAR(64) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id VARCHAR(64) NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        quantity INT NOT NULL,
        unit_price NUMERIC(10, 2) NOT NULL,
        subtotal NUMERIC(10, 2) NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(allocated_branch_id);
      CREATE INDEX IF NOT EXISTS idx_branch_stocks_branch ON branch_stocks(branch_id);
    `);

    await client.query("COMMIT;");
    console.log("PostgreSQL schema initialized successfully.");
  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("Error initializing PostgreSQL schema:", err);
    throw err;
  } finally {
    client.release();
  }
}
