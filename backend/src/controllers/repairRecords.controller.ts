import { Request, Response } from "express";
import { pool } from "../config/db";
import { RepairRecord } from "../types";

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
  const { rows } = await pool.query(`
    SELECT rec.*, r.customer_id, c.customer_name, c.phone AS customer_phone
    FROM repair_records rec
    JOIN repair_requests r ON r.repair_id = rec.repair_id
    JOIN customers c ON c.customer_id = r.customer_id
    ORDER BY rec.created_at DESC
  `);
  res.json(rows.map(mapRow));
}

export async function getOne(req: Request, res: Response) {
  const { id } = req.params;
  const { rows } = await pool.query(
    "SELECT * FROM repair_records WHERE record_id = $1", [id]
  );
  if (!rows.length) return res.status(404).json({ error: "ไม่พบบันทึกการซ่อม" });
  res.json(mapRow(rows[0]));
}

export async function remove(req: Request, res: Response) {
  await pool.query("DELETE FROM repair_records WHERE record_id = $1", [req.params.id]);
  res.status(204).end();
}
