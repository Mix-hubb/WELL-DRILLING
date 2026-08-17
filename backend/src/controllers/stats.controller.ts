import { Request, Response } from "express";
import { pool } from "../config/db";
import { RowDataPacket } from "mysql2";
import { userFilter } from "../utils/userFilter";
import { StatsOverview } from "../types";

export async function overview(req: Request, res: Response) {
  const { sql, params } = userFilter(req);

  const [[reqCounts]] = await pool.query<RowDataPacket[]>(`
    SELECT
      SUM(r.status = 'NEW')      AS new_count,
      SUM(r.status = 'QUOTED')   AS quoted_count,
      SUM(r.status = 'ACCEPTED') AS accepted_count
    FROM drilling_requests r
    JOIN customers c ON c.customer_id = r.customer_id
    WHERE 1=1 ${sql}
  `, params);

  const [[jobCounts]] = await pool.query<RowDataPacket[]>(`
    SELECT
      SUM(j.status = 'QUEUED')   AS queued,
      SUM(j.status = 'DRILLING') AS drilling,
      SUM(j.status = 'SUCCESS')  AS success,
      SUM(j.status = 'FAILED')   AS failed,
      SUM(j.status = 'CLOSED')   AS closed,
      COUNT(*)                   AS total
    FROM drilling_jobs j
    JOIN customers c ON c.customer_id = j.customer_id
    WHERE 1=1 ${sql}
  `, params);

  const [[repairCounts]] = await pool.query<RowDataPacket[]>(`
    SELECT
      SUM(r.status = 'NEW')          AS new_count,
      SUM(r.status IN ('SCHEDULED','IN_PROGRESS')) AS in_progress_count,
      SUM(r.status = 'COMPLETED')    AS completed_count
    FROM repair_requests r
    JOIN customers c ON c.customer_id = r.customer_id
    WHERE 1=1 ${sql}
  `, params);

  const [[wellAgg]] = await pool.query<RowDataPacket[]>(`
    SELECT
      COUNT(*)                       AS well_count,
      COALESCE(AVG(w.total_depth_m),0) AS avg_depth,
      COALESCE(MAX(w.total_depth_m),0) AS max_depth,
      COALESCE(AVG(w.water_quantity_m3hr),0) AS avg_water
    FROM wells w
    JOIN customers c ON c.customer_id = w.customer_id
    WHERE 1=1 ${sql}
  `, params);

  const [[warrantyCounts]] = await pool.query<RowDataPacket[]>(`
    SELECT
      SUM(w.warranty_expire_date >= CURDATE())                                AS warranty_active,
      SUM(w.warranty_expire_date >= CURDATE()
          AND DATEDIFF(w.warranty_expire_date, CURDATE()) <= 30)              AS warranty_expiring_soon,
      SUM(w.warranty_expire_date < CURDATE())                                 AS warranty_expired
    FROM wells w
    JOIN customers c ON c.customer_id = w.customer_id
    WHERE w.warranty_expire_date IS NOT NULL ${sql}
  `, params);

  const [recentJobs] = await pool.query<RowDataPacket[]>(`
    SELECT j.job_id, j.job_title, j.status, j.scheduled_date, c.customer_name
    FROM drilling_jobs j
    JOIN customers c ON c.customer_id = j.customer_id
    WHERE 1=1 ${sql}
    ORDER BY j.created_at DESC
    LIMIT 6
  `, params);

  const overview: StatsOverview = {
    requests: {
      new: Number(reqCounts.new_count) || 0,
      quoted: Number(reqCounts.quoted_count) || 0,
      accepted: Number(reqCounts.accepted_count) || 0,
    },
    jobs: {
      queued: Number(jobCounts.queued) || 0,
      drilling: Number(jobCounts.drilling) || 0,
      success: Number(jobCounts.success) || 0,
      failed: Number(jobCounts.failed) || 0,
      closed: Number(jobCounts.closed) || 0,
      total: Number(jobCounts.total) || 0,
    },
    repairs: {
      new: Number(repairCounts.new_count) || 0,
      inProgress: Number(repairCounts.in_progress_count) || 0,
      completed: Number(repairCounts.completed_count) || 0,
    },
    wells: {
      count: Number(wellAgg.well_count) || 0,
      avgDepth: Number(wellAgg.avg_depth) || 0,
      maxDepth: Number(wellAgg.max_depth) || 0,
      avgWater: Number(wellAgg.avg_water) || 0,
    },
    warranty: {
      active: Number(warrantyCounts.warranty_active) || 0,
      expiringSoon: Number(warrantyCounts.warranty_expiring_soon) || 0,
      expired: Number(warrantyCounts.warranty_expired) || 0,
    },
    recentJobs: recentJobs as StatsOverview["recentJobs"],
  };

  res.json(overview);
}
