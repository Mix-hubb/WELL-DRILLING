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
import orgRoutes              from "./routes/org.routes";
import { authMiddleware, adminMiddleware } from "./middleware/auth";
import { magicAuth, magicResourceAuth } from "./middleware/upload";
import { asyncHandler }      from "./utils/asyncHandler";
import { sanitizeLiffId }    from "./utils/liffId";

import { requestContext, logError } from "./middleware/observability";
import { apiLimiter, authLimiter, publicLimiter } from "./middleware/rateLimit";
import * as jobsCtrl         from "./controllers/jobs.controller";
import * as repairCtrl       from "./controllers/repairRequests.controller";
import * as drillingReqCtrl  from "./controllers/drillingRequests.controller";
import * as wellsCtrl        from "./controllers/wells.controller";

const app = express();

app.set("trust proxy", 1);
app.use(requestContext);

const corsOrigin = process.env.CORS_ORIGIN || (process.env.NODE_ENV === "production" ? false : "*");
app.use(cors({ origin: corsOrigin }));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
});
app.use(express.json({
  limit: "1mb",
  verify: (_req, _res, buf) => { (_req as any).rawBody = buf; },
}));
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

app.get("/api/health", publicLimiter, async (_req, res) => {
  try {
    const { pool } = await import("./config/db.js");
    await pool.query("SELECT 1 as ok");
    res.json({ ok: true, db: "connected", time: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ ok: false, db: "disconnected", error: err.message, code: err.code });
  }
});

app.get("/api/debug/postback-test/:customerId/:requestId", authMiddleware, adminMiddleware, apiLimiter, async (req, res) => {
  try {
    const { pool } = await import("./config/db.js");
    const { customerId, requestId } = req.params;

    const cust = await pool.query(
      "SELECT customer_id, customer_name, line_user_id, org_id FROM customers WHERE customer_id = $1", [customerId]
    );
    if (!cust.rows.length) return res.status(404).json({ error: "ไม่พบลูกค้า" });

    const org = cust.rows[0].org_id
      ? (await pool.query("SELECT org_id, line_channel_access_token, line_channel_id FROM organizations WHERE org_id = $1", [cust.rows[0].org_id])).rows[0]
      : null;

    const drillReq = await pool.query(
      "SELECT request_id, status, customer_id FROM drilling_requests WHERE request_id = $1", [requestId]
    );

    const quotation = await pool.query(
      "SELECT quotation_id, kind, price, status, drilling_request_id FROM quotations WHERE drilling_request_id = $1", [requestId]
    );

    res.json({
      customer: cust.rows[0],
      organization: org ? { org_id: org.org_id, channel_id: org.line_channel_id, has_token: !!org.line_channel_access_token } : null,
      drilling_request: drillReq.rows[0] || null,
      quotation: quotation.rows[0] || null,
      postback_data_accept: `accept_drill_${requestId}`,
      postback_data_reject: `reject_drill_${requestId}`,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/debug/overview", authMiddleware, adminMiddleware, apiLimiter, async (_req, res) => {
  try {
    const { pool } = await import("./config/db.js");
    const customers = await pool.query(
      "SELECT customer_id, customer_name, phone, line_user_id, org_id FROM customers ORDER BY created_at DESC LIMIT 20"
    );
    const drillingReqs = await pool.query(
      "SELECT request_id, customer_id, status, name, phone FROM drilling_requests ORDER BY created_at DESC LIMIT 20"
    );
    const repairReqs = await pool.query(
      "SELECT repair_id, customer_id, status FROM repair_requests ORDER BY created_at DESC LIMIT 20"
    );
    const quotations = await pool.query(
      "SELECT quotation_id, kind, drilling_request_id, repair_request_id, price, status FROM quotations ORDER BY created_at DESC LIMIT 20"
    );
    const jobs = await pool.query(
      "SELECT job_id, request_id, customer_id, status FROM drilling_jobs ORDER BY created_at DESC LIMIT 10"
    );
    const orgs = await pool.query(
      "SELECT org_id, name, line_channel_id, line_channel_secret, line_liff_id_drilling, line_liff_id_repair, CASE WHEN line_channel_access_token IS NOT NULL AND length(line_channel_access_token) > 0 THEN true ELSE false END as has_token FROM organizations"
    );
    res.json({
      customers: customers.rows,
      drilling_requests: drillingReqs.rows,
      repair_requests: repairReqs.rows,
      quotations: quotations.rows,
      jobs: jobs.rows,
      organizations: orgs.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Public auth routes (rate limit: 10 attempts / 15 min)
app.use("/api/auth", authLimiter, authRoutes);

// Public routes — ฟอร์มลูกค้า (rate limit: 20 req/min)
app.post("/api/public/repair-requests", publicLimiter, asyncHandler(repairCtrl.createFromPublicForm));
app.post("/api/public/drilling-requests", publicLimiter, asyncHandler(drillingReqCtrl.createFromPublicForm));
app.get("/api/public/liff-info", publicLimiter, asyncHandler(async (req: any, res: any) => {
  const { liff_id } = req.query;
  if (!liff_id) return res.status(400).json({ error: "ต้องระบุ liff_id" });
  const cleanId = sanitizeLiffId(liff_id);
  if (!cleanId) return res.status(400).json({ error: "ต้องระบุ liff_id" });
  const { pool } = await import("./config/db.js");
  const result = await pool.query(
    `SELECT org_id, line_liff_id_drilling, line_liff_id_repair FROM organizations
     WHERE line_liff_id_drilling = $1 OR line_liff_id_repair = $1 ORDER BY created_at DESC LIMIT 1`,
    [cleanId]
  );
  if (!result.rows.length) return res.json({ found: false });
  const org = result.rows[0];
  let formType = "";
  if (org.line_liff_id_drilling === cleanId) formType = "request-drill";
  else if (org.line_liff_id_repair === cleanId) formType = "repair-form";
  res.json({ found: true, formType, org_id: org.org_id });
}));
app.get("/api/public/customer-by-line", publicLimiter, asyncHandler(async (req: any, res: any) => {
  const { line_user_id } = req.query;
  const { liff_id } = req.query;
  if (!line_user_id || !liff_id) return res.status(400).json({ error: "ต้องระบุ line_user_id และ liff_id" });
  const cleanId = sanitizeLiffId(liff_id);
  if (!cleanId) return res.status(400).json({ error: "ต้องระบุ liff_id" });
  const { pool } = await import("./config/db.js");
  const result = await pool.query(
    `SELECT c.customer_id, c.customer_name, c.phone, c.address
     FROM customers c
     JOIN organizations o ON o.org_id = c.org_id
     WHERE c.line_user_id = $1
       AND (o.line_liff_id_drilling = $2 OR o.line_liff_id_repair = $2)
     LIMIT 1`,
    [line_user_id, cleanId]
  );
  if (!result.rows.length) return res.json({ found: false });
  const c = result.rows[0];
  const requests = await pool.query(
    "SELECT request_id, name, phone, address, status FROM drilling_requests WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1",
    [c.customer_id]
  );
  const wells = await pool.query(
    "SELECT well_id, well_name FROM wells WHERE customer_id = $1 ORDER BY created_at ASC",
    [c.customer_id]
  );
  res.json({ found: true, customer: c, lastRequest: requests.rows[0] || null, wells: wells.rows });
}));
app.get("/api/public/wells/:id/report.pdf", publicLimiter, asyncHandler(wellsCtrl.exportReport));
app.get("/api/public/repairs/:id/receipt.pdf", publicLimiter, asyncHandler(repairCtrl.exportReceipt));
app.get("/api/jobs/magic/:token", publicLimiter, magicAuth, asyncHandler(jobsCtrl.getByMagicToken));
app.patch("/api/jobs/:id/well", publicLimiter, magicResourceAuth("job"), asyncHandler(jobsCtrl.completeWell));
app.get("/api/repair-requests/magic/:token", publicLimiter, magicAuth, asyncHandler(repairCtrl.getByMagicToken));
app.post("/api/repair-requests/:id/records", publicLimiter, magicResourceAuth("repair"), asyncHandler(repairCtrl.addRecord));
app.use("/api/pump-catalog", publicLimiter, pumpCatalogRoutes);
app.use("/api/upload", publicLimiter, uploadRoutes);
app.use("/api/webhooks", publicLimiter, webhookRoutes);

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
app.use("/api/org",               authMiddleware, apiLimiter, orgRoutes);


// centralized error handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logError(err, _req.header("x-request-id"));
  // Postgres 22P02 = invalid_text_representation — a malformed id (e.g. missing/undefined)
  // was passed into a uuid/int column. This is a client input error, not a server fault.
  if (err?.code === "22P02") {
    return res.status(400).json({ error: "รูปแบบข้อมูลไม่ถูกต้อง", code: err.code });
  }
  res.status(500).json({ error: err?.message || "เกิดข้อผิดพลาดที่เซิร์ฟเวอร์", code: err?.code });
});

process.on("unhandledRejection", (reason) => logError(reason));

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  const { pool } = await import("./config/db.js");
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
