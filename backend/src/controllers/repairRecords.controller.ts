import { Request, Response } from "express";
import { pool } from "../config/db";
import { userFilter } from "../utils/userFilter";
import { RepairRecord } from "../types";
import { broadcast } from "../services/sse";

function mapRow(row: any): RepairRecord {
  return {
    record_id: row.record_id,
    repair_id: row.repair_id,
    final_price: row.final_price,
    work_details: row.work_details,
    parts: typeof row.parts === "string" ? JSON.parse(row.parts) : (row.parts || []),
    pump: typeof row.pump === "string" ? JSON.parse(row.pump) : (row.pump || null),
    is_warranty_claim: row.is_warranty_claim,
    completed_at: row.completed_at,
    created_at: row.created_at,
  };
}

export async function list(req: Request, res: Response) {
  const { sql, params } = userFilter(req, "c");
  const { rows } = await pool.query(`
    SELECT rec.*, r.customer_id, c.customer_name, c.phone AS customer_phone
    FROM repair_records rec
    JOIN repair_requests r ON r.repair_id = rec.repair_id
    JOIN customers c ON c.customer_id = r.customer_id
    WHERE 1=1 ${sql}
    ORDER BY rec.created_at DESC
  `, params);
  res.json(rows.map(mapRow));
}

export async function getOne(req: Request, res: Response) {
  const { id } = req.params;
  const { sql, params } = userFilter(req, "c", 1);
  const { rows } = await pool.query(
    `SELECT rec.*
     FROM repair_records rec
     JOIN repair_requests r ON r.repair_id = rec.repair_id
     JOIN customers c ON c.customer_id = r.customer_id
     WHERE rec.record_id = $1${sql}`,
    [id, ...params]
  );
  if (!rows.length) return res.status(404).json({ error: "ไม่พบบันทึกการซ่อม" });
  res.json(mapRow(rows[0]));
}

export async function remove(req: Request, res: Response) {
  const { sql, params } = userFilter(req, "c", 1);
  const existing = await pool.query(
    `SELECT rec.record_id
     FROM repair_records rec
     JOIN repair_requests r ON r.repair_id = rec.repair_id
     JOIN customers c ON c.customer_id = r.customer_id
     WHERE rec.record_id = $1${sql}`,
    [req.params.id, ...params]
  );
  if (!existing.rows.length) return res.status(404).json({ error: "ไม่พบบันทึก" });
  await pool.query("DELETE FROM repair_records WHERE record_id = $1", [req.params.id]);
  broadcast({ type: "REPAIR_RECORD_DELETED", data: { record_id: Number(req.params.id) }, orgId: req.user?.orgId });
  res.status(204).end();
}
