import { Request, Response } from "express";
import { pool } from "../config/db";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { userFilter } from "../utils/userFilter";

async function wellBelongsToUser(wellId: string | number, req: Request): Promise<boolean> {
  if (req.user!.role === "ADMIN") return true;
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 1 FROM well_logs w
     JOIN drilling_jobs j ON j.job_id = w.job_id
     JOIN customers c ON c.customer_id = j.customer_id
     WHERE w.well_id = ? AND c.user_id = ?`,
    [wellId, req.user!.userId]
  );
  return rows.length > 0;
}

// ============================================================
// GET /api/maintenance/well/:wellId
// ============================================================
export async function listByWell(req: Request, res: Response) {
  if (!await wellBelongsToUser(req.params.wellId, req)) {
    return res.status(404).json({ error: "ไม่พบบ่อบาดาล" });
  }
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      m.*,
      et.type_name_th AS event_type_name,
      et.type_name    AS event_type_name_en
    FROM maintenance_logs m
    INNER JOIN maintenance_event_types et ON et.event_type_id = m.event_type_id
    WHERE m.well_id = ?
    ORDER BY m.event_date DESC
  `, [req.params.wellId]);
  res.json(rows);
}

// ============================================================
// GET /api/maintenance/overdue
// ============================================================
export async function listOverdue(req: Request, res: Response) {
  const { sql, params } = userFilter(req);
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      m.maintenance_id,
      m.event_date,
      m.next_service_date,
      m.performed_by,
      DATEDIFF(CURDATE(), m.next_service_date) AS days_overdue,
      et.type_name_th AS event_type_name,
      j.job_reference,
      j.province,
      c.customer_name,
      c.phone AS customer_phone,
      w.well_id
    FROM maintenance_logs m
    INNER JOIN maintenance_event_types et ON et.event_type_id = m.event_type_id
    INNER JOIN well_logs      w  ON w.well_id     = m.well_id
    INNER JOIN drilling_jobs  j  ON j.job_id      = w.job_id
    INNER JOIN customers      c  ON c.customer_id = j.customer_id
    WHERE m.next_service_date < CURDATE() ${sql}
    ORDER BY days_overdue DESC
  `, params);
  res.json(rows);
}

// ============================================================
// GET /api/maintenance/event-types
// ============================================================
export async function listEventTypes(_req: Request, res: Response) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM maintenance_event_types ORDER BY event_type_id"
  );
  res.json(rows);
}

// ============================================================
// POST /api/maintenance/well/:wellId
// ============================================================
export async function create(req: Request, res: Response) {
  const { event_type_id, event_date, description, performed_by, next_service_date, is_warranty_claim } = req.body;

  if (!event_type_id || !event_date || !description || !performed_by) {
    return res.status(400).json({
      error: "ข้อมูลไม่ครบ: event_type_id, event_date, description, performed_by",
    });
  }

  if (!await wellBelongsToUser(req.params.wellId, req)) {
    return res.status(404).json({ error: "ไม่พบบ่อบาดาล" });
  }

  const [result] = await pool.query<ResultSetHeader>(`
    INSERT INTO maintenance_logs
      (well_id, event_type_id, event_date, description, performed_by, next_service_date, is_warranty_claim)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    req.params.wellId,
    event_type_id,
    event_date,
    description,
    performed_by,
    next_service_date || null,
    is_warranty_claim ? 1 : 0,
  ]);

  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT m.*, et.type_name_th AS event_type_name
    FROM maintenance_logs m
    INNER JOIN maintenance_event_types et ON et.event_type_id = m.event_type_id
    WHERE m.maintenance_id = ?
  `, [result.insertId]);

  res.status(201).json(rows[0]);
}

// ============================================================
// DELETE /api/maintenance/:id
// ============================================================
export async function remove(req: Request, res: Response) {
  const { sql, params } = userFilter(req);
  await pool.query(
    `DELETE m FROM maintenance_logs m
     JOIN well_logs w ON w.well_id = m.well_id
     JOIN drilling_jobs j ON j.job_id = w.job_id
     JOIN customers c ON c.customer_id = j.customer_id
     WHERE m.maintenance_id = ?${sql}`,
    [req.params.id, ...params]
  );
  res.status(204).end();
}
