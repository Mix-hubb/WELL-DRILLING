import { Request, Response } from "express";
import { pool } from "../config/db";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { userFilter } from "../utils/userFilter";
import { DrillingRequest } from "../types";
import { sendTextToCustomer } from "../services/line";

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
    appointment_date: row.appointment_date,
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
  const { customer_id, source, name, phone, address, requested_depth_m, appointment_date, notes } = req.body;
  if (!customer_id || !name || !phone || !address) {
    return res.status(400).json({ error: "ต้องระบุ customer_id, name, phone, address" });
  }
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO drilling_requests (customer_id, source, name, phone, address, requested_depth_m, appointment_date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [customer_id, source || "MANUAL", name, phone, address, requested_depth_m ?? null, appointment_date ?? null, notes || null]
  );
  const [rows] = await pool.query<RowDataPacket[]>(
    `${REQUEST_SELECT} WHERE r.request_id = ?`, [result.insertId]
  );

  if (source === "LINE") {
    sendTextToCustomer(customer_id, "เตรียมพร้อมสำหรับวันนัดหมายครับ ทีมงานจะตรวจสอบและติดต่อกลับโดยเร็ว", "STATUS").catch(() => {});
  }

  res.status(201).json(mapRow(rows[0]));
}

export async function update(req: Request, res: Response) {
  const { id } = req.params;
  const { name, phone, address, requested_depth_m, appointment_date, notes } = req.body;

  const [existing] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM drilling_requests WHERE request_id = ?", [id]
  );
  if (!existing.length) return res.status(404).json({ error: "ไม่พบคำร้องเจาะ" });

  await pool.query(
    `UPDATE drilling_requests SET name = ?, phone = ?, address = ?, requested_depth_m = ?, appointment_date = ?, notes = ? WHERE request_id = ?`,
    [
      name ?? existing[0].name,
      phone ?? existing[0].phone,
      address ?? existing[0].address,
      requested_depth_m ?? existing[0].requested_depth_m,
      appointment_date ?? existing[0].appointment_date,
      notes ?? existing[0].notes,
      id,
    ]
  );

  const [rows] = await pool.query<RowDataPacket[]>(
    `${REQUEST_SELECT} WHERE r.request_id = ?`, [id]
  );
  res.json(mapRow(rows[0]));
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

export async function createFromPublicForm(req: Request, res: Response) {
  const { name, phone, address, requested_depth_m, appointment_date, notes } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: "ต้องระบุชื่อและเบอร์โทร" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existing] = await conn.query<RowDataPacket[]>(
      "SELECT customer_id FROM customers WHERE phone = ? LIMIT 1",
      [phone]
    );

    let customerId: number;
    if (existing.length) {
      customerId = existing[0].customer_id;
      await conn.query(
        "UPDATE customers SET customer_name = COALESCE(?, customer_name), address = COALESCE(?, address) WHERE customer_id = ?",
        [name, address || null, customerId]
      );
    } else {
      const [c] = await conn.query<ResultSetHeader>(
        "INSERT INTO customers (customer_name, phone, address) VALUES (?, ?, ?)",
        [name, phone, address || null]
      );
      customerId = c.insertId;
    }

    const [r] = await conn.query<ResultSetHeader>(
      `INSERT INTO drilling_requests (customer_id, source, name, phone, address, requested_depth_m, appointment_date, notes)
       VALUES (?, 'LINE', ?, ?, ?, ?, ?, ?)`,
      [customerId, name, phone, address || null, requested_depth_m ?? null, appointment_date ?? null, notes || null]
    );

    await conn.commit();

    sendTextToCustomer(customerId, "เตรียมพร้อมสำหรับวันนัดหมายครับ ทีมงานจะตรวจสอบและติดต่อกลับโดยเร็ว", "STATUS").catch(() => {});

    res.status(201).json({ request_id: r.insertId, customer_id: customerId });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
