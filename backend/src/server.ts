import "dotenv/config";
import express from "express";
import cors from "cors";

import authRoutes        from "./routes/auth.routes";
import customersRoutes   from "./routes/customers.routes";
import jobsRoutes        from "./routes/jobs.routes";
import wellsRoutes       from "./routes/wells.routes";
import statsRoutes       from "./routes/stats.routes";
import warrantyRoutes    from "./routes/warranty.routes";
import maintenanceRoutes from "./routes/maintenance.routes";
import { authMiddleware } from "./middleware/auth";

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

// Public auth routes
app.use("/api/auth", authRoutes);

// Protected routes
app.use("/api/customers",   authMiddleware, customersRoutes);
app.use("/api/jobs",        authMiddleware, jobsRoutes);
app.use("/api/wells",       authMiddleware, wellsRoutes);
app.use("/api/stats",       authMiddleware, statsRoutes);
app.use("/api/warranty",    authMiddleware, warrantyRoutes);
app.use("/api/maintenance", authMiddleware, maintenanceRoutes);

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
app.listen(PORT, () => console.log(`✅ DGWM API listening on http://localhost:${PORT}`));
