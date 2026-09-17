import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initSchema } from "./db/schema.js";
import { seedDatabase } from "./db/seed.js";
import { query } from "./db/database.js";

import authRoutes from "./routes/auth.js";
import productsRoutes from "./routes/products.js";
import branchesRoutes from "./routes/branches.js";
import usersRoutes from "./routes/users.js";
import ordersRoutes from "./routes/orders.js";
import dashboardRoutes from "./routes/dashboard.js";
import aiRoutes from "./routes/ai.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Locate compiled frontend dist for single-service production deployment
const potentialDistPaths = [
  path.resolve(process.cwd(), "Smart Order Allocation System/dist"),
  path.resolve(process.cwd(), "../Smart Order Allocation System/dist"),
  path.resolve(__dirname, "../../Smart Order Allocation System/dist"),
  path.resolve(__dirname, "../Smart Order Allocation System/dist"),
];
const frontendDist = potentialDistPaths.find((p) => fs.existsSync(p));

// Initialize Database schema and auto-seed if empty
async function initDb() {
  try {
    await initSchema();
    const countRes = await query("SELECT COUNT(*)::int as c FROM users");
    const count = countRes.rows[0]?.c ?? 0;
    if (count === 0) {
      console.log("Empty database detected. Auto-seeding initial data...");
      await seedDatabase();
    }
  } catch (err) {
    console.error("Database startup check failed (will retry on incoming requests):", err);
  }
}
initDb();

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allows flexible API and inline styles
}));

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use(express.json({ limit: "2mb" }));

// Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { success: false, error: "Too many requests. Please try again later." },
});
app.use("/api", globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  message: { success: false, error: "Too many login attempts. Please try again after 15 minutes." },
});
app.use("/api/auth", authLimiter);

// Health Check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "healthy",
    service: "Smart Order Allocation System (SOAS) API",
    database: process.env.DATABASE_URL ? "PostgreSQL (Connected)" : "PostgreSQL (Local)",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// Mount API Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/branches", branchesRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/ai", aiRoutes);

// API 404 Handler
app.use("/api/*", (_req, res) => {
  res.status(404).json({ success: false, error: "API endpoint not found." });
});

// Serve frontend static assets if built
if (frontendDist) {
  console.log(`📦 Serving frontend static assets from: ${frontendDist}`);
  app.use(express.static(frontendDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
} else {
  app.use((_req, res) => {
    res.status(404).json({ success: false, error: "Endpoint not found." });
  });
}

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled Server Error:", err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal server error occurred.",
  });
});

let server: any = null;
const isMain = process.argv[1]?.endsWith("server.ts") || process.argv[1]?.endsWith("server.js");
if (isMain) {
  server = app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 SOAS Backend Server running on http://localhost:${PORT}`);
    console.log(`🐘 Database: ${process.env.DATABASE_URL ? "Cloud PostgreSQL" : "Local PostgreSQL"}`);
    console.log(`🤖 AI Engine: Active`);
    if (frontendDist) {
      console.log(`🌐 Web UI: Active on http://localhost:${PORT}`);
    }
    console.log(`====================================================`);
  });
}

export { app, server };
export default app;
