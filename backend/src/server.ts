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
import { authMiddleware }    from "./middleware/auth";
import { asyncHandler }      from "./utils/asyncHandler";
import * as jobsCtrl         from "./controllers/jobs.controller";
import * as repairCtrl       from "./controllers/repairRequests.controller";
import * as drillingReqCtrl  from "./controllers/drillingRequests.controller";

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ verify: (_req, _res, buf) => { (_req as any).rawBody = buf; } }));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/api/health", async (_req, res) => {
  try {
    const { pool } = await import("./config/db");
    const result = await pool.query("SELECT 1 as ok");
    res.json({ ok: true, db: "connected", time: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ ok: false, db: "disconnected", error: err.message, code: err.code });
  }
});

// Public auth routes
app.use("/api/auth", authRoutes);

// Public routes — ฟอร์มลูกค้า (สร้างคำร้องซ่อม/เจาะ) + magic link ช่าง
app.post("/api/public/repair-requests", asyncHandler(repairCtrl.createFromPublicForm));
app.post("/api/public/drilling-requests", asyncHandler(drillingReqCtrl.createFromPublicForm));
app.get("/api/public/customer-by-line", asyncHandler(async (req: any, res: any) => {
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

// Protected routes
app.use("/api/customers",         authMiddleware, customersRoutes);
app.use("/api/jobs",              authMiddleware, jobsRoutes);
app.use("/api/wells",             authMiddleware, wellsRoutes);
app.use("/api/stats",             authMiddleware, statsRoutes);
app.use("/api/drilling-requests", authMiddleware, drillingRequestsRoutes);
app.use("/api/repair-requests",   authMiddleware, repairRequestsRoutes);
app.use("/api/quotations",        authMiddleware, quotationsRoutes);
app.use("/api/repair-records",    authMiddleware, repairRecordsRoutes);

// centralized error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err?.message || "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์", code: err?.code });
});

process.on("unhandledRejection", (reason) => console.error("Unhandled rejection:", reason));

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => console.log(`✅ Well-Drilling API listening on http://localhost:${PORT}`));
