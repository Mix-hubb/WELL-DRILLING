import { Request, Response } from "express";
import { pool } from "../config/db";
import { userFilter } from "../utils/userFilter";
import { StatsOverview } from "../types";

export async function overview(req: Request, res: Response) {
  const { sql, params } = userFilter(req);

  const reqCounts = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE r.status = 'NEW')      AS new_count,
      COUNT(*) FILTER (WHERE r.status = 'QUOTED')    AS quoted_count,
      COUNT(*) FILTER (WHERE r.status = 'ACCEPTED')  AS accepted_count
    FROM drilling_requests r
    JOIN customers c ON c.customer_id = r.customer_id
    WHERE 1=1 ${sql}
  `, params);

  const jobCounts = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE j.status = 'QUEUED')    AS queued,
      COUNT(*) FILTER (WHERE j.status = 'DRILLING')  AS drilling,
      COUNT(*) FILTER (WHERE j.status = 'SUCCESS')   AS success,
      COUNT(*) FILTER (WHERE j.status = 'FAILED')    AS failed,
      COUNT(*) FILTER (WHERE j.status = 'CLOSED')    AS closed,
      COUNT(*)                                        AS total
    FROM drilling_jobs j
    JOIN customers c ON c.customer_id = j.customer_id
    WHERE 1=1 ${sql}
  `, params);

  const repairCounts = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE r.status = 'NEW')                          AS new_count,
      COUNT(*) FILTER (WHERE r.status IN ('SCHEDULED','IN_PROGRESS'))    AS in_progress_count,
      COUNT(*) FILTER (WHERE r.status = 'COMPLETED')                     AS completed_count
    FROM repair_requests r
    JOIN customers c ON c.customer_id = r.customer_id
    WHERE 1=1 ${sql}
  `, params);

  const wellAgg = await pool.query(`
    SELECT
      COUNT(*)                         AS well_count,
      COALESCE(AVG(w.total_depth_m),0) AS avg_depth,
      COALESCE(MAX(w.total_depth_m),0) AS max_depth,
      COALESCE(AVG(w.water_quantity_m3hr),0) AS avg_water
    FROM wells w
    JOIN customers c ON c.customer_id = w.customer_id
    WHERE 1=1 ${sql}
  `, params);

  const warrantyCounts = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE w.warranty_expire_date >= CURRENT_DATE)                                                  AS warranty_active,
      COUNT(*) FILTER (WHERE w.warranty_expire_date >= CURRENT_DATE AND (w.warranty_expire_date - CURRENT_DATE) <= 30) AS warranty_expiring_soon,
      COUNT(*) FILTER (WHERE w.warranty_expire_date < CURRENT_DATE)                                                    AS warranty_expired
    FROM wells w
    JOIN customers c ON c.customer_id = w.customer_id
    WHERE w.warranty_expire_date IS NOT NULL ${sql}
  `, params);

  const recentJobs = await pool.query(`
    SELECT j.job_id, j.job_title, j.status, j.scheduled_date, c.customer_name
    FROM drilling_jobs j
    JOIN customers c ON c.customer_id = j.customer_id
    WHERE 1=1 ${sql}
    ORDER BY j.created_at DESC
    LIMIT 6
  `, params);

  const overview: StatsOverview = {
    requests: {
      new: Number(reqCounts.rows[0].new_count) || 0,
      quoted: Number(reqCounts.rows[0].quoted_count) || 0,
      accepted: Number(reqCounts.rows[0].accepted_count) || 0,
    },
    jobs: {
      queued: Number(jobCounts.rows[0].queued) || 0,
      drilling: Number(jobCounts.rows[0].drilling) || 0,
      success: Number(jobCounts.rows[0].success) || 0,
      failed: Number(jobCounts.rows[0].failed) || 0,
      closed: Number(jobCounts.rows[0].closed) || 0,
      total: Number(jobCounts.rows[0].total) || 0,
    },
    repairs: {
      new: Number(repairCounts.rows[0].new_count) || 0,
      inProgress: Number(repairCounts.rows[0].in_progress_count) || 0,
      completed: Number(repairCounts.rows[0].completed_count) || 0,
    },
    wells: {
      count: Number(wellAgg.rows[0].well_count) || 0,
      avgDepth: Number(wellAgg.rows[0].avg_depth) || 0,
      maxDepth: Number(wellAgg.rows[0].max_depth) || 0,
      avgWater: Number(wellAgg.rows[0].avg_water) || 0,
    },
    warranty: {
      active: Number(warrantyCounts.rows[0].warranty_active) || 0,
      expiringSoon: Number(warrantyCounts.rows[0].warranty_expiring_soon) || 0,
      expired: Number(warrantyCounts.rows[0].warranty_expired) || 0,
    },
    recentJobs: recentJobs.rows as StatsOverview["recentJobs"],
  };

  res.json(overview);
}
