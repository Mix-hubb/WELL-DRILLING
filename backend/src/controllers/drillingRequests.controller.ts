import { Request, Response } from "express";
import { pool } from "../config/db";
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

function mapRow(row: any): DrillingRequest {
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
    where += " AND r.status = $1";
    whereParams.push(status);
  }

  const { rows } = await pool.query(
    `${REQUEST_SELECT} WHERE ${where} ${sql} ORDER BY r.created_at DESC`,
    [...whereParams, ...params]
  );
  res.json(rows.map(mapRow));
}

export async function getOne(req: Request, res: Response) {
  const { id } = req.params;
  const { rows } = await pool.query(
    `${REQUEST_SELECT} WHERE r.request_id = $1`, [id]
  );
  if (!rows.length) return res.status(404).json({ error: "ไม่พบคำร้องเจาะ" });
  res.json(mapRow(rows[0]));
}

export async function create(req: Request, res: Response) {
  const { customer_id, source, name, phone, address, requested_depth_m, appointment_date, notes } = req.body;
  if (!customer_id || !name || !phone || !address) {
    return res.status(400).json({ error: "ต้องระบุ customer_id, name, phone, address" });
  }
  const { rows } = await pool.query(
    `INSERT INTO drilling_requests (customer_id, source, name, phone, address, requested_depth_m, appointment_date, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING request_id`,
    [customer_id, source || "MANUAL", name, phone, address, requested_depth_m ?? null, appointment_date ?? null, notes || null]
  );

  const newId = rows[0].request_id;

  if (source === "LINE") {
    sendTextToCustomer(customer_id, "เราได้รับคำร้องของคุณแล้ว กรุณารอการตอบกลับจากทีมงานครับ", "STATUS").catch(() => {});
  }

  const result = await pool.query(`${REQUEST_SELECT} WHERE r.request_id = $1`, [newId]);
  res.status(201).json(mapRow(result.rows[0]));
}

export async function update(req: Request, res: Response) {
  const { id } = req.params;
  const { name, phone, address, requested_depth_m, appointment_date, notes } = req.body;

  const existing = await pool.query(
    "SELECT * FROM drilling_requests WHERE request_id = $1", [id]
  );
  if (!existing.rows.length) return res.status(404).json({ error: "ไม่พบคำร้องเจาะ" });

  await pool.query(
    `UPDATE drilling_requests SET name = $1, phone = $2, address = $3, requested_depth_m = $4, appointment_date = $5, notes = $6 WHERE request_id = $7`,
    [
      name ?? existing.rows[0].name,
      phone ?? existing.rows[0].phone,
      address ?? existing.rows[0].address,
      requested_depth_m ?? existing.rows[0].requested_depth_m,
      appointment_date ?? existing.rows[0].appointment_date,
      notes ?? existing.rows[0].notes,
      id,
    ]
  );

  const { rows } = await pool.query(
    `${REQUEST_SELECT} WHERE r.request_id = $1`, [id]
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

  await pool.query("UPDATE drilling_requests SET status = $1 WHERE request_id = $2", [status, id]);

  const { rows } = await pool.query(
    `${REQUEST_SELECT} WHERE r.request_id = $1`, [id]
  );
  if (!rows.length) return res.status(404).json({ error: "ไม่พบคำร้องเจาะ" });
  res.json(mapRow(rows[0]));
}

export async function remove(req: Request, res: Response) {
  await pool.query("DELETE FROM drilling_requests WHERE request_id = $1", [req.params.id]);
  res.status(204).end();
}

export async function createFromPublicForm(req: Request, res: Response) {
  const { name, phone, address, requested_depth_m, appointment_date, notes, line_user_id } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: "ต้องระบุชื่อและเบอร์โทร" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existing = await client.query(
      "SELECT customer_id FROM customers WHERE phone = $1 LIMIT 1",
      [phone]
    );

    let customerId: number;
    if (existing.rows.length) {
      customerId = existing.rows[0].customer_id;
      await client.query(
        "UPDATE customers SET customer_name = COALESCE($1, customer_name), address = COALESCE($2, address), line_user_id = COALESCE($3, line_user_id) WHERE customer_id = $4",
        [name, address || null, line_user_id || null, customerId]
      );
    } else {
      const c = await client.query(
        "INSERT INTO customers (customer_name, phone, address, line_user_id) VALUES ($1, $2, $3, $4) RETURNING customer_id",
        [name, phone, address || null, line_user_id || null]
      );
      customerId = c.rows[0].customer_id;
    }

    const r = await client.query(
      `INSERT INTO drilling_requests (customer_id, source, name, phone, address, requested_depth_m, appointment_date, notes)
       VALUES ($1, 'LINE', $2, $3, $4, $5, $6, $7) RETURNING request_id`,
      [customerId, name, phone, address || null, requested_depth_m ?? null, appointment_date ?? null, notes || null]
    );

    await client.query("COMMIT");

    sendTextToCustomer(customerId, "เตรียมพร้อมสำหรับวันนัดหมายครับ ทีมงานจะตรวจสอบและติดต่อกลับโดยเร็ว", "STATUS").catch(() => {});

    res.status(201).json({ request_id: r.rows[0].request_id, customer_id: customerId });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
