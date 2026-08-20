import { Request, Response } from "express";
import crypto from "crypto";
import { pool } from "../config/db";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { userFilter } from "../utils/userFilter";
import { RepairRequest } from "../types";
import { sendTextToCustomer, sendFlexToCustomer } from "../services/line";

function generateMagicToken(): string {
  return "repair-" + crypto.randomBytes(16).toString("hex");
}

const REQUEST_SELECT = `
  SELECT
    r.*,
    c.customer_name,
    c.phone AS customer_phone,
    w.well_name,
    q.quotation_id, q.price AS quotation_price, q.status AS quotation_status, q.notes AS quotation_notes
  FROM repair_requests r
  JOIN customers c ON c.customer_id = r.customer_id
  LEFT JOIN wells w ON w.well_id = r.well_id
  LEFT JOIN quotations q ON q.kind = 'REPAIR' AND q.repair_request_id = r.repair_id
`;

function mapRow(row: RowDataPacket): RepairRequest {
  return {
    repair_id: row.repair_id,
    customer_id: row.customer_id,
    well_id: row.well_id,
    problems: typeof row.problems === "string" ? JSON.parse(row.problems) : (row.problems || []),
    detail: row.detail,
    photos: typeof row.photos === "string" ? JSON.parse(row.photos) : (row.photos || []),
    scheduled_date: row.scheduled_date,
    status: row.status,
    magic_link_token: row.magic_link_token,
    magic_link_expires_at: row.magic_link_expires_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    well_name: row.well_name,
    quotation: row.quotation_id ? {
      quotation_id: row.quotation_id,
      kind: "REPAIR",
      drilling_request_id: null,
      repair_request_id: row.repair_id,
      price: Number(row.quotation_price),
      status: row.quotation_status,
      notes: row.quotation_notes,
    } : null,
  };
}

async function attachRecords(rows: RepairRequest[], dbRows: RowDataPacket[]) {
  const ids = dbRows.map((r) => r.repair_id);
  if (!ids.length) return rows;
  const [records] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM repair_records WHERE repair_id IN (?) ORDER BY created_at DESC`,
    [ids]
  );
  for (const row of rows) {
    row.records = records.filter((rec) => rec.repair_id === row.repair_id) as any;
  }
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

  const [dbRows] = await pool.query<RowDataPacket[]>(
    `${REQUEST_SELECT} WHERE ${where} ${sql} ORDER BY r.created_at DESC`,
    [...whereParams, ...params]
  );
  const rows = dbRows.map(mapRow);
  await attachRecords(rows, dbRows);
  res.json(rows);
}

export async function getOne(req: Request, res: Response) {
  const { id } = req.params;
  const [dbRows] = await pool.query<RowDataPacket[]>(
    `${REQUEST_SELECT} WHERE r.repair_id = ?`, [id]
  );
  if (!dbRows.length) return res.status(404).json({ error: "ไม่พบคำร้องซ่อม" });
  const row = mapRow(dbRows[0]);
  await attachRecords([row], dbRows);
  res.json(row);
}

export async function create(req: Request, res: Response) {
  const { customer_id, well_id, problems, detail, photos, scheduled_date } = req.body;
  if (!customer_id || !problems?.length) {
    return res.status(400).json({ error: "ต้องระบุ customer_id และ problems" });
  }
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO repair_requests (customer_id, well_id, problems, detail, photos, scheduled_date, magic_link_token, magic_link_expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))`,
    [customer_id, well_id || null, JSON.stringify(problems), detail || null, photos?.length ? JSON.stringify(photos) : null, scheduled_date || null, generateMagicToken()]
  );
  const [rows] = await pool.query<RowDataPacket[]>(
    `${REQUEST_SELECT} WHERE r.repair_id = ?`, [result.insertId]
  );
  res.status(201).json(mapRow(rows[0]));
}

export async function createFromPublicForm(req: Request, res: Response) {
  const { name, phone, address, well_name, problems, detail, photos, scheduled_date, line_user_id } = req.body;
  if (!name || !phone || !problems?.length) {
    return res.status(400).json({ error: "ต้องระบุชื่อ, เบอร์โทร และปัญหาที่พบ" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let customerId: number;

    const [existing] = await conn.query<RowDataPacket[]>(
      "SELECT customer_id FROM customers WHERE phone = ? LIMIT 1",
      [phone]
    );

    if (existing.length) {
      customerId = existing[0].customer_id;
      await conn.query(
        "UPDATE customers SET customer_name = COALESCE(?, customer_name), address = COALESCE(?, address), line_user_id = COALESCE(?, line_user_id) WHERE customer_id = ?",
        [name, address || null, line_user_id || null, customerId]
      );
    } else {
      const [c] = await conn.query<ResultSetHeader>(
        "INSERT INTO customers (customer_name, phone, address, line_user_id) VALUES (?, ?, ?, ?)",
        [name, phone, address || null, line_user_id || null]
      );
      customerId = c.insertId;
    }

    const [wells] = await conn.query<RowDataPacket[]>(
      "SELECT well_id FROM wells WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1", [customerId]
    );

    const combinedDetail = well_name
      ? `บ่อ: ${well_name}${detail ? `\n${detail}` : ""}`
      : (detail || null);

    const [r] = await conn.query<ResultSetHeader>(
      `INSERT INTO repair_requests (customer_id, well_id, problems, detail, photos, scheduled_date, magic_link_token, magic_link_expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))`,
      [customerId, wells.length ? wells[0].well_id : null, JSON.stringify(problems), combinedDetail, photos?.length ? JSON.stringify(photos) : null, scheduled_date || null, generateMagicToken()]
    );

    await conn.commit();

    sendTextToCustomer(customerId, "ได้รับแจ้งซ่อมเรียบร้อยแล้วครับ ทีมงานจะตรวจสอบและติดต่อกลับโดยเร็ว กรุณารอการติดต่อกลับครับ", "STATUS").catch(() => {});

    res.status(201).json({ repair_id: r.insertId, customer_id: customerId });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function update(req: Request, res: Response) {
  const { id } = req.params;
  const { well_id, problems, detail, scheduled_date } = req.body;

  const [existing] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM repair_requests WHERE repair_id = ?", [id]
  );
  if (!existing.length) return res.status(404).json({ error: "ไม่พบคำร้องซ่อม" });

  const curProblems = typeof existing[0].problems === "string" ? JSON.parse(existing[0].problems) : existing[0].problems;

  await pool.query(
    `UPDATE repair_requests SET well_id = ?, problems = ?, detail = ?, scheduled_date = ? WHERE repair_id = ?`,
    [
      well_id ?? existing[0].well_id,
      problems ? JSON.stringify(problems) : JSON.stringify(curProblems),
      detail ?? existing[0].detail,
      scheduled_date ?? existing[0].scheduled_date,
      id,
    ]
  );

  const [rows] = await pool.query<RowDataPacket[]>(
    `${REQUEST_SELECT} WHERE r.repair_id = ?`, [id]
  );
  res.json(mapRow(rows[0]));
}

export async function updateStatus(req: Request, res: Response) {
  const { id } = req.params;
  const { status } = req.body;

  const valid = ["NEW", "QUOTED", "ACCEPTED", "REJECTED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CLOSED", "CANCELLED"];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `สถานะไม่ถูกต้อง ต้องเป็น ${valid.join(", ")}` });
  }

  await pool.query("UPDATE repair_requests SET status = ? WHERE repair_id = ?", [status, id]);

  const [rows] = await pool.query<RowDataPacket[]>(
    `${REQUEST_SELECT} WHERE r.repair_id = ?`, [id]
  );
  if (!rows.length) return res.status(404).json({ error: "ไม่พบคำร้องซ่อม" });

  const customerId = rows[0].customer_id;
  if (customerId && status === "IN_PROGRESS") {
    sendTextToCustomer(customerId, "ขณะนี้ช่างกำลังดำเนินการซ่อมบำรุงให้ครับ กรุณารอสักครู่", "STATUS").catch(() => {});
  }
  if (customerId && status === "CLOSED") {
    const liffUrl = process.env.LINE_LIFF_ID
      ? `https://liff.line.me/${process.env.LINE_LIFF_ID}/repair-form`
      : `${process.env.APP_URL || "http://localhost:5173"}/repair-form`;
    sendTextToCustomer(customerId, `การซ่อมบำรุงเสร็จเรียบร้อยแล้วครับ กรุณาอัปโหลดสลิปโอนเงินผ่านลิงก์นี้:\n${liffUrl}`, "STATUS").catch(() => {});
  }

  res.json(mapRow(rows[0]));
}

export async function getByMagicToken(req: Request, res: Response) {
  const { token } = req.params;
  const [dbRows] = await pool.query<RowDataPacket[]>(
    `${REQUEST_SELECT} WHERE r.magic_link_token = ?
     AND (r.magic_link_expires_at IS NULL OR r.magic_link_expires_at > NOW())`,
    [token]
  );
  if (!dbRows.length) return res.status(404).json({ error: "ลิงก์ไม่ถูกต้องหรือหมดอายุ" });
  const row = mapRow(dbRows[0]);
  await attachRecords([row], dbRows);
  res.json(row);
}

export async function addRecord(req: Request, res: Response) {
  const { id } = req.params;
  const {
    magic_token,
    final_price,
    work_details,
    parts,
    pump,
    is_warranty_claim,
    completed_at,
  } = req.body;

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM repair_requests
     WHERE repair_id = ? AND (magic_link_expires_at IS NULL OR magic_link_expires_at > NOW())`,
    [id]
  );
  if (!rows.length) return res.status(404).json({ error: "ไม่พบคำร้องหรือลิงก์หมดอายุ" });
  if (magic_token && rows[0].magic_link_token !== magic_token) {
    return res.status(403).json({ error: "Token ไม่ถูกต้อง" });
  }

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO repair_records (repair_id, final_price, work_details, parts, pump, is_warranty_claim, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      final_price ?? null,
      work_details || null,
      parts?.length ? JSON.stringify(parts) : null,
      pump ? JSON.stringify(pump) : null,
      is_warranty_claim ? 1 : 0,
      completed_at || new Date().toISOString().replace("T", " ").slice(0, 19),
    ]
  );

  await pool.query("UPDATE repair_requests SET status = 'COMPLETED' WHERE repair_id = ?", [id]);

  const [recs] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM repair_records WHERE record_id = ?", [result.insertId]
  );

  const [reqRow] = await pool.query<RowDataPacket[]>(
    "SELECT customer_id FROM repair_requests WHERE repair_id = ?", [id]
  );
  if (reqRow.length) {
    const partsList = parts?.length
      ? "\nรายการอะไหล่: " + parts.map((p: any) => `${p.name} x${p.qty}`).join(", ")
      : "";
    const msg = final_price != null
      ? `แจ้งผลการซ่อมเสร็จเรียบร้อยแล้วครับ\n\nรายละเอียดงาน:\n${work_details || "-"}${partsList}\n\nราคาจบงาน ${Number(final_price).toLocaleString("th-TH")} บาท\n\nกรุณาอัปโหลดสลิปโอนเงินผ่านลิงก์ในแชทครับ`
      : `แจ้งผลการซ่อมเสร็จเรียบร้อยแล้วครับ\n\nรายละเอียดงาน:\n${work_details || "-"}${partsList}\n\nกรุณาอัปโหลดสลิปโอนเงินผ่านลิงก์ในแชทครับ`;
    sendTextToCustomer(reqRow[0].customer_id, msg, "STATUS").catch(() => {});
  }

  res.status(201).json(recs[0]);
}

export async function remove(req: Request, res: Response) {
  await pool.query("DELETE FROM repair_requests WHERE repair_id = ?", [req.params.id]);
  res.status(204).end();
}

export async function generateMagicLink(req: Request, res: Response) {
  const { id } = req.params;
  const token = generateMagicToken();
  await pool.query(
    "UPDATE repair_requests SET magic_link_token = ?, magic_link_expires_at = DATE_ADD(NOW(), INTERVAL 7 DAY) WHERE repair_id = ?",
    [token, id]
  );
  res.json({ token });
}


