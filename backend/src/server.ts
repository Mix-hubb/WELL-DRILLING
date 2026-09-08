import "dotenv/config";
import express from "express";
import path from "path";
import cors from "cors";

import authRoutes            from "./routes/auth.routes";
import customersRoutes       from "./routes/customers.routes";
import jobsRoutes            from "./routes/jobs.routes";
import wellsRoutes           from "./routes/wells.routes";
import statsRoutes           from "./routes/stats.routes";
import drillingRequestsRoutes from "./routes/drillingRequests.routes";
import repairRequestsRoutes  from "./routes/repairRequests.routes";
import quotationsRoutes      from "./routes/quotations.routes";
import repairRecordsRoutes   from "./routes/repairRecords.routes";
import pumpCatalogRoutes     from "./routes/pumpCatalog.routes";
import uploadRoutes          from "./routes/upload.routes";
import webhookRoutes         from "./routes/webhooks.routes";
import lineSettingsRoutes     from "./routes/lineSettings.routes";
import { authMiddleware }    from "./middleware/auth";
import { asyncHandler }      from "./utils/asyncHandler";
import { verifyToken }       from "./middleware/auth";
import { addClient, clientCount } from "./services/sse";
import { apiLimiter, authLimiter, publicLimiter } from "./middleware/rateLimit";
import * as jobsCtrl         from "./controllers/jobs.controller";
import * as repairCtrl       from "./controllers/repairRequests.controller";
import * as drillingReqCtrl  from "./controllers/drillingRequests.controller";

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ verify: (_req, _res, buf) => { (_req as any).rawBody = buf; } }));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Request timeout middleware (30s)
app.use((_req, res, next) => {
  res.setTimeout(30000, () => {
    if (!res.headersSent) {
      res.status(504).json({ error: "Request timeout" });
    }
  });
  next();
});

app.get("/api/health", async (_req, res) => {
  try {
    const { pool } = await import("./config/db");
    await pool.query("SELECT 1 as ok");
    res.json({ ok: true, db: "connected", time: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ ok: false, db: "disconnected", error: err.message, code: err.code });
  }
});

// Public auth routes (rate limit: 10 attempts / 15 min)
app.use("/api/auth", authLimiter, authRoutes);

// Public routes — ฟอร์มลูกค้า (rate limit: 20 req/min)
app.post("/api/public/repair-requests", publicLimiter, asyncHandler(repairCtrl.createFromPublicForm));
app.post("/api/public/drilling-requests", publicLimiter, asyncHandler(drillingReqCtrl.createFromPublicForm));
app.get("/api/public/customer-by-line", publicLimiter, asyncHandler(async (req: any, res: any) => {
  const { line_user_id } = req.query;
  if (!line_user_id) return res.status(400).json({ error: "ต้องระบุ line_user_id" });
  const { pool } = await import("./config/db");
  const result = await pool.query(
    "SELECT customer_id, customer_name, phone, address FROM customers WHERE line_user_id = $1 LIMIT 1",
    [line_user_id]
  );
  if (!result.rows.length) return res.json({ found: false });
  const c = result.rows[0];
  const requests = await pool.query(
    "SELECT request_id, name, phone, address, status FROM drilling_requests WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1",
    [c.customer_id]
  );
  res.json({ found: true, customer: c, lastRequest: requests.rows[0] || null });
}));
app.get("/api/jobs/magic/:token", asyncHandler(jobsCtrl.getByMagicToken));
app.patch("/api/jobs/:id/well", asyncHandler(jobsCtrl.completeWell));
app.get("/api/repair-requests/magic/:token", asyncHandler(repairCtrl.getByMagicToken));
app.post("/api/repair-requests/:id/records", asyncHandler(repairCtrl.addRecord));
app.use("/api/pump-catalog", pumpCatalogRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/webhooks", webhookRoutes);

// SSE endpoint — real-time dashboard updates (cap at 50 concurrent)
const MAX_SSE_CLIENTS = 50;
app.get("/api/events", (req, res) => {
  if (clientCount() >= MAX_SSE_CLIENTS) {
    return res.status(429).json({ error: "Too many SSE connections" });
  }
  const token = req.query.token as string;
  if (!token) {
    return res.status(401).json({ error: "ต้องระบุ token" });
  }
  let orgId: string | null | undefined;
  try {
    const decoded = verifyToken(token);
    orgId = decoded.orgId;
  } catch {
    return res.status(401).json({ error: "Token ไม่ถูกต้องหรือหมดอายุ" });
  }
  const ok = addClient(res, undefined, orgId);
  if (!ok) return;
  req.on("close", () => {});
});

// Protected routes (rate limit: 60 req/min)
app.use("/api/customers",         authMiddleware, apiLimiter, customersRoutes);
app.use("/api/jobs",              authMiddleware, apiLimiter, jobsRoutes);
app.use("/api/wells",             authMiddleware, apiLimiter, wellsRoutes);
app.use("/api/stats",             authMiddleware, apiLimiter, statsRoutes);
app.use("/api/drilling-requests", authMiddleware, apiLimiter, drillingRequestsRoutes);
app.use("/api/repair-requests",   authMiddleware, apiLimiter, repairRequestsRoutes);
app.use("/api/quotations",        authMiddleware, apiLimiter, quotationsRoutes);
app.use("/api/repair-records",    authMiddleware, apiLimiter, repairRecordsRoutes);
app.use("/api/line-settings",     authMiddleware, apiLimiter, lineSettingsRoutes);

// centralized error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err?.message || "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์", code: err?.code });
});

process.on("unhandledRejection", (reason) => console.error("Unhandled rejection:", reason));

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  const { pool } = await import("./config/db");
  server.close(() => {
    console.log("HTTP server closed.");
    pool.end().then(() => {
      console.log("Database pool closed.");
      process.exit(0);
    });
  });
  setTimeout(() => {
    console.error("Forced shutdown after timeout.");
    process.exit(1);
  }, 10000);
}

const PORT = Number(process.env.PORT) || 4000;
const server = app.listen(PORT, () => console.log(`✅ Well-Drilling API listening on http://localhost:${PORT}`));

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
