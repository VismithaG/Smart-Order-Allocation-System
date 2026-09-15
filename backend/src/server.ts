import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { initSchema } from "./db/schema.js";
import { seedDatabase } from "./db/seed.js";
import { db } from "./db/database.js";

import authRoutes from "./routes/auth.js";
import productsRoutes from "./routes/products.js";
import branchesRoutes from "./routes/branches.js";
import ordersRoutes from "./routes/orders.js";
import dashboardRoutes from "./routes/dashboard.js";
import aiRoutes from "./routes/ai.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize Database schema and auto-seed if empty
initSchema();
const userCount = (db.prepare("SELECT COUNT(*) as c FROM users").get() as any).c;
if (userCount === 0) {
  console.log("Empty database detected. Auto-seeding initial data...");
  seedDatabase();
}

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allows flexible API usage
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || true,
  credentials: true,
}));

app.use(express.json({ limit: "2mb" }));

// Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { success: false, error: "Too many requests. Please try again later." },
});
app.use("/api", globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, error: "Too many login attempts. Please try again after 15 minutes." },
});
app.use("/api/auth", authLimiter);

// Health Check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "healthy",
    service: "Smart Order Allocation System (SOAS) API",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

// Mount Routes
app.use("/api/auth", authRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/branches", branchesRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/ai", aiRoutes);

// 404 Handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Endpoint not found." });
});

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled Server Error:", err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || "Internal server error occurred.",
  });
});

const server = app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 SOAS Backend Server running on http://localhost:${PORT}`);
  console.log(`📦 Database: SQLite (Persistent with WAL mode)`);
  console.log(`🤖 AI Engine: scikit-learn Logistic Regression Model Loaded`);
  console.log(`====================================================`);
});

export { app, server };
export default app;
