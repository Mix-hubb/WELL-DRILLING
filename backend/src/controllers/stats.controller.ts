import { Request, Response } from "express";
import { pool } from "../config/db";
import { RowDataPacket } from "mysql2";

export async function overview(_req: Request, res: Response) {
  const [[jobCounts]] = await pool.query<RowDataPacket[]>(`
    SELECT
      SUM(status = 'PENDING')   AS pending,
      SUM(status = 'DRILLING')  AS drilling,
      SUM(status = 'COMPLETED') AS completed,
      COUNT(*)                  AS total
    FROM drilling_jobs
    WHERE status != 'ARCHIVED'
  `);

  const [[wellAgg]] = await pool.query<RowDataPacket[]>(`
    SELECT
      COUNT(*)                     AS well_count,
      COALESCE(AVG(total_depth),0) AS avg_depth,
      COALESCE(MAX(total_depth),0) AS max_depth,
      COALESCE(AVG(water_quantity),0) AS avg_water
    FROM well_logs
  `);

  // Warranty summary
  const [[warrantyCounts]] = await pool.query<RowDataPacket[]>(`
    SELECT
      SUM(w.warranty_expire_date >= CURDATE())                                    AS warranty_active,
      SUM(w.warranty_expire_date >= CURDATE()
          AND DATEDIFF(w.warranty_expire_date, CURDATE()) <= 30)                  AS warranty_expiring_soon,
      SUM(w.warranty_expire_date < CURDATE())                                     AS warranty_expired
    FROM well_logs w
    JOIN drilling_jobs j ON j.job_id = w.job_id
    WHERE j.status = 'COMPLETED'
  `);

  // Strata breakdown — ใช้ lithology_name_th
  const [strataBreakdown] = await pool.query<RowDataPacket[]>(`
    SELECT
      lt.type_name    AS strata_type,
      lt.type_name_th AS strata_label,
      lt.color_hex,
      COUNT(*)                                AS segment_count,
      COALESCE(SUM(s.depth_to - s.depth_from), 0) AS total_meters
    FROM well_strata_logs s
    JOIN lithology_types lt ON lt.type_id = s.lithology_type_id
    GROUP BY lt.type_id, lt.type_name, lt.type_name_th, lt.color_hex
    ORDER BY total_meters DESC
  `);

  const [recentJobs] = await pool.query<RowDataPacket[]>(`
    SELECT j.job_id, j.job_reference, j.job_title, j.status, j.scheduled_date,
           c.customer_name
    FROM drilling_jobs j
    JOIN customers c ON c.customer_id = j.customer_id
    WHERE j.status != 'ARCHIVED'
    ORDER BY j.created_at DESC
    LIMIT 6
  `);

  res.json({
    jobs: {
      pending:   Number(jobCounts.pending)   || 0,
      drilling:  Number(jobCounts.drilling)  || 0,
      completed: Number(jobCounts.completed) || 0,
      total:     Number(jobCounts.total)     || 0,
    },
    wells: {
      count:    Number(wellAgg.well_count) || 0,
      avgDepth: Number(wellAgg.avg_depth)  || 0,
      maxDepth: Number(wellAgg.max_depth)  || 0,
      avgWater: Number(wellAgg.avg_water)  || 0,
    },
    warranty: {
      active:       Number(warrantyCounts.warranty_active)        || 0,
      expiringSoon: Number(warrantyCounts.warranty_expiring_soon) || 0,
      expired:      Number(warrantyCounts.warranty_expired)       || 0,
    },
    strataBreakdown,
    recentJobs,
  });
}
