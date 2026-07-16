import { Request, Response } from "express";
import { pool } from "../config/db";
import { RowDataPacket } from "mysql2";
import { userFilter } from "../utils/userFilter";

// ============================================================
// GET /api/warranty
// ============================================================
export async function list(req: Request, res: Response) {
  const { filter } = req.query;
  const { sql, params } = userFilter(req);

  let having = "";
  if (filter === "active")        having = "HAVING alert_tier = 'ACTIVE'";
  else if (filter === "expiring") having = "HAVING alert_tier = 'EXPIRING_SOON'";
  else if (filter === "expired")  having = "HAVING alert_tier = 'EXPIRED'";

  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      j.job_id,
      j.job_reference,
      j.province,
      j.district,
      c.customer_name,
      c.phone AS customer_phone,
      w.well_id,
      w.total_depth,
      w.yield_lpm,
      w.completion_date,
      w.warranty_expire_date,
      CASE
        WHEN w.warranty_expire_date >= CURDATE() THEN 'IN_WARRANTY'
        ELSE 'EXPIRED'
      END AS warranty_status,
      DATEDIFF(w.warranty_expire_date, CURDATE()) AS remaining_days,
      CASE
        WHEN w.warranty_expire_date < CURDATE()                                THEN 'EXPIRED'
        WHEN DATEDIFF(w.warranty_expire_date, CURDATE()) <= 30                 THEN 'EXPIRING_SOON'
        ELSE 'ACTIVE'
      END AS alert_tier
    FROM well_logs w
    INNER JOIN drilling_jobs j  ON j.job_id       = w.job_id
    INNER JOIN customers      c ON c.customer_id  = j.customer_id
    WHERE j.status = 'COMPLETED' ${sql}
    ${having}
    ORDER BY
      CASE WHEN w.warranty_expire_date >= CURDATE() THEN 0 ELSE 1 END ASC,
      remaining_days ASC
  `, params);

  res.json(rows);
}

// ============================================================
// GET /api/warranty/summary
// ============================================================
export async function summary(req: Request, res: Response) {
  const { sql, params } = userFilter(req);

  const [[counts]] = await pool.query<RowDataPacket[]>(`
    SELECT
      COUNT(*)                                                    AS total_wells,
      SUM(w.warranty_expire_date >= CURDATE())                    AS active,
      SUM(w.warranty_expire_date >= CURDATE()
          AND DATEDIFF(w.warranty_expire_date, CURDATE()) <= 30)  AS expiring_soon,
      SUM(w.warranty_expire_date < CURDATE())                     AS expired
    FROM well_logs w
    INNER JOIN drilling_jobs j ON j.job_id = w.job_id
    INNER JOIN customers c ON c.customer_id = j.customer_id
    WHERE j.status = 'COMPLETED' ${sql}
  `, params);

  res.json({
    total:       Number(counts.total_wells)   || 0,
    active:      Number(counts.active)        || 0,
    expiringSoon: Number(counts.expiring_soon)|| 0,
    expired:     Number(counts.expired)       || 0,
  });
}
