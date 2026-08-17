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

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ verify: (_req, _res, buf) => { (_req as any).rawBody = buf; } }));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/api/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Public auth routes
app.use("/api/auth", authRoutes);

// Public routes — ฟอร์มลูกค้า (สร้างคำร้องซ่อม) + magic link ช่าง
app.post("/api/public/repair-requests", asyncHandler(repairCtrl.createFromPublicForm));
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
  if (process.env.NODE_ENV === "production") {
    return res.status(500).json({ error: "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
  }
  res.status(500).json({ error: err?.message || "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์" });
});

process.on("unhandledRejection", (reason) => console.error("Unhandled rejection:", reason));

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => console.log(`✅ Well-Drilling API listening on http://localhost:${PORT}`));
