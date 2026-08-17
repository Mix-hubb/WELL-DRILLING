import { Request, Response } from "express";
import { pool } from "../config/db";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { userFilter } from "../utils/userFilter";
import { DrillingRequest } from "../types";

const REQUEST_SELECT = `
  SELECT
    r.*,
    c.customer_name,
    c.phone AS customer_phone,
    q.quotation_id, q.price AS quotation_price, q.status AS quotation_status, q.notes AS quotation_notes,
    j.job_id, j.status AS job_status, j.well_id
  FROM drilling_requests r
  JOIN customers c ON c.customer_id = r.customer_id
  LEFT JOIN quotations q ON q.kind = 'DRILLING' AND q.drilling_request_id = r.request_id
  LEFT JOIN drilling_jobs j ON j.request_id = r.request_id
`;

function mapRow(row: RowDataPacket): DrillingRequest {
  return {
    request_id: row.request_id,
    customer_id: row.customer_id,
    source: row.source,
    name: row.name,
    phone: row.phone,
    address: row.address,
    requested_depth_m: row.requested_depth_m,
    status: row.status,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    quotation: row.quotation_id ? {
      quotation_id: row.quotation_id,
      kind: "DRILLING",
      drilling_request_id: row.request_id,
      repair_request_id: null,
      price: Number(row.quotation_price),
      status: row.quotation_status,
      notes: row.quotation_notes,
    } : null,
    job: row.job_id ? { job_id: row.job_id, status: row.job_status, well_id: row.well_id } as any : null,
  };
}

export async function list(req: Request, res: Response) {
  const { status } = req.query;
  const { sql, params } = userFilter(req);

  let where = "1=1";
  const whereParams: any[] = [];
  if (status && status !== "ALL") {
    where += " AND r.status = ?";
    whereParams.push(status);
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `${REQUEST_SELECT} WHERE ${where} ${sql} ORDER BY r.created_at DESC`,
    [...whereParams, ...params]
  );
  res.json(rows.map(mapRow));
}

export async function getOne(req: Request, res: Response) {
  const { id } = req.params;
  const [rows] = await pool.query<RowDataPacket[]>(
    `${REQUEST_SELECT} WHERE r.request_id = ?`, [id]
  );
  if (!rows.length) return res.status(404).json({ error: "ไม่พบคำร้องเจาะ" });
  res.json(mapRow(rows[0]));
}

export async function create(req: Request, res: Response) {
  const { customer_id, source, name, phone, address, requested_depth_m, notes } = req.body;
  if (!customer_id || !name || !phone || !address) {
    return res.status(400).json({ error: "ต้องระบุ customer_id, name, phone, address" });
  }
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO drilling_requests (customer_id, source, name, phone, address, requested_depth_m, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [customer_id, source || "MANUAL", name, phone, address, requested_depth_m ?? null, notes || null]
  );
  const [rows] = await pool.query<RowDataPacket[]>(
    `${REQUEST_SELECT} WHERE r.request_id = ?`, [result.insertId]
  );
  res.status(201).json(mapRow(rows[0]));
}

export async function updateStatus(req: Request, res: Response) {
  const { id } = req.params;
  const { status } = req.body;

  const valid = ["NEW", "QUOTED", "ACCEPTED", "REJECTED", "CANCELLED"];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `สถานะไม่ถูกต้อง ต้องเป็น ${valid.join(", ")}` });
  }

  await pool.query("UPDATE drilling_requests SET status = ? WHERE request_id = ?", [status, id]);

  const [rows] = await pool.query<RowDataPacket[]>(
    `${REQUEST_SELECT} WHERE r.request_id = ?`, [id]
  );
  if (!rows.length) return res.status(404).json({ error: "ไม่พบคำร้องเจาะ" });
  res.json(mapRow(rows[0]));
}

export async function remove(req: Request, res: Response) {
  await pool.query("DELETE FROM drilling_requests WHERE request_id = ?", [req.params.id]);
  res.status(204).end();
}
