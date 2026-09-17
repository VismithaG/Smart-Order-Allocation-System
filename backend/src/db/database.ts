import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const isCloudDatabase = Boolean(
  process.env.DATABASE_URL &&
  !process.env.DATABASE_URL.includes("localhost") &&
  !process.env.DATABASE_URL.includes("127.0.0.1")
);

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT || "5432"),
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "postgrespassword",
  database: process.env.PGDATABASE || "soas_db",
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: isCloudDatabase ? { rejectUnauthorized: false } : undefined,
});

pool.on("error", (err) => {
  console.error("Unexpected error on idle PostgreSQL client", err);
});

export async function query(text: string, params?: any[]): Promise<pg.QueryResult<any>> {
  return pool.query(text, params);
}

export default pool;
