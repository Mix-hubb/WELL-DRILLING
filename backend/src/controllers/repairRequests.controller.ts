import { Request, Response } from "express";
import crypto from "crypto";
import { pool } from "../config/db";
import { userFilter } from "../utils/userFilter";
import { RepairRequest } from "../types";
import { sendTextToCustomer } from "../services/line";
import { broadcast } from "../services/sse";
import { resolveOrgId } from "../utils/resolveOrg";

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

function mapRow(row: any): RepairRequest {
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

async function attachRecords(rows: RepairRequest[], dbRows: any[]) {
  const ids = dbRows.map((r) => r.repair_id);
  if (!ids.length) return rows;
  const { rows: records } = await pool.query(
    `SELECT * FROM repair_records WHERE repair_id = ANY($1::uuid[]) ORDER BY created_at DESC`,
    [ids]
  );
  for (const row of rows) {
    row.records = records.filter((rec: any) => rec.repair_id === row.repair_id) as any;
  }
}

export async function list(req: Request, res: Response) {
  const { status } = req.query;
  const whereParams: any[] = [];
  let where = "1=1";
  if (status && status !== "ALL") {
    where += " AND r.status = $1";
    whereParams.push(status);
  }

  const { sql, params } = userFilter(req, "c", whereParams.length);

  const { rows: dbRows } = await pool.query(
    `${REQUEST_SELECT} WHERE ${where} ${sql} ORDER BY r.created_at DESC`,
    [...whereParams, ...params]
  );
  const rows = dbRows.map(mapRow);
  await attachRecords(rows, dbRows);
  res.json(rows);
}

export async function getOne(req: Request, res: Response) {
  const { id } = req.params;
  const { sql, params } = userFilter(req, "c", 1);
  const { rows: dbRows } = await pool.query(
    `${REQUEST_SELECT} WHERE r.repair_id = $1${sql}`, [id, ...params]
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

  const { sql, params } = userFilter(req, "c", 1);
  const ownershipCheck = await pool.query(
    `SELECT c.customer_id FROM customers c WHERE c.customer_id = $1${sql}`,
    [customer_id, ...params]
  );
  if (!ownershipCheck.rows.length) {
    return res.status(404).json({ error: "ไม่พบลูกค้าหรือไม่มีสิทธิ์เข้าถึง" });
  }

  const { rows } = await pool.query(
    `INSERT INTO repair_requests (customer_id, well_id, problems, detail, photos, scheduled_date, magic_link_token, magic_link_expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '7 days')
     RETURNING repair_id`,
    [customer_id, well_id || null, JSON.stringify(problems), detail || null, photos?.length ? JSON.stringify(photos) : null, scheduled_date || null, generateMagicToken()]
  );
  const newId = rows[0].repair_id;
  const result = await pool.query(`${REQUEST_SELECT} WHERE r.repair_id = $1`, [newId]);
  broadcast({ type: "REPAIR_REQUEST_CREATED", data: { repair_id: newId }, orgId: req.user?.orgId });
  res.status(201).json(mapRow(result.rows[0]));
}

export async function createFromPublicForm(req: Request, res: Response) {
  const { name, phone, address, well_name, problems, detail, photos, scheduled_date, line_user_id, line_display_name, line_picture_url, org_id, liff_id } = req.body;
  if (!name || !phone || !problems?.length) {
    return res.status(400).json({ error: "ต้องระบุชื่อ, เบอร์โทร และปัญหาที่พบ" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const resolvedOrgId = await resolveOrgId(client, liff_id, org_id);

    let customerId: number;

    let existing;
    if (line_user_id) {
      existing = resolvedOrgId
        ? await client.query(
            "SELECT customer_id FROM customers WHERE line_user_id = $1 AND org_id = $2 LIMIT 1",
            [line_user_id, resolvedOrgId]
          )
        : await client.query(
            "SELECT customer_id FROM customers WHERE line_user_id = $1 LIMIT 1",
            [line_user_id]
          );
    }
    if (!existing?.rows.length) {
      existing = resolvedOrgId
        ? await client.query(
            "SELECT customer_id FROM customers WHERE phone = $1 AND org_id = $2 LIMIT 1",
            [phone, resolvedOrgId]
          )
        : await client.query(
            "SELECT customer_id FROM customers WHERE phone = $1 LIMIT 1",
            [phone]
          );
    }

    if (existing?.rows.length) {
      customerId = existing.rows[0].customer_id;
      const updateFields: string[] = [];
      const updateParams: any[] = [];
      let idx = 1;

      updateFields.push(`customer_name = COALESCE($${idx++}, customer_name)`);
      updateParams.push(name);
      updateFields.push(`phone = COALESCE($${idx++}, phone)`);
      updateParams.push(phone);
      if (address) {
        updateFields.push(`address = COALESCE($${idx++}, address)`);
        updateParams.push(address);
      }
      if (line_user_id) {
        updateFields.push(`line_user_id = COALESCE($${idx++}, line_user_id)`);
        updateParams.push(line_user_id);
      }
      if (line_display_name) {
        updateFields.push(`line_display_name = COALESCE($${idx++}, line_display_name)`);
        updateParams.push(line_display_name);
      }
      if (line_picture_url) {
        updateFields.push(`line_picture_url = COALESCE($${idx++}, line_picture_url)`);
        updateParams.push(line_picture_url);
      }
      if (resolvedOrgId) {
        updateFields.push(`org_id = COALESCE($${idx++}, org_id)`);
        updateParams.push(resolvedOrgId);
      }

      updateParams.push(customerId);
      await client.query(
        `UPDATE customers SET ${updateFields.join(", ")} WHERE customer_id = $${idx}`,
        updateParams
      );
    } else {
      const c = await client.query(
        "INSERT INTO customers (customer_name, phone, address, line_user_id, line_display_name, line_picture_url, org_id) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING customer_id",
        [name, phone, address || null, line_user_id || null, line_display_name || null, line_picture_url || null, resolvedOrgId]
      );
      customerId = c.rows[0].customer_id;
    }

    const wells = await client.query(
      "SELECT well_id FROM wells WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1", [customerId]
    );

    const combinedDetail = well_name
      ? `บ่อ: ${well_name}${detail ? `\n${detail}` : ""}`
      : (detail || null);

    const r = await client.query(
      `INSERT INTO repair_requests (customer_id, well_id, problems, detail, photos, scheduled_date, magic_link_token, magic_link_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '7 days')
       RETURNING repair_id`,
      [customerId, wells.rows.length ? wells.rows[0].well_id : null, JSON.stringify(problems), combinedDetail, photos?.length ? JSON.stringify(photos) : null, scheduled_date || null, generateMagicToken()]
    );

    await client.query("COMMIT");

    broadcast({ type: "REPAIR_REQUEST_CREATED", data: { repair_id: r.rows[0].repair_id }, orgId: resolvedOrgId });
    sendTextToCustomer(customerId, "เราได้รับคำร้องซ่อมของคุณแล้ว กรุณารอการตอบกลับจากทีมงานครับ", "STATUS", resolvedOrgId).catch(() => {});

    res.status(201).json({ repair_id: r.rows[0].repair_id, customer_id: customerId });
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function update(req: Request, res: Response) {
  const { id } = req.params;
  const { well_id, problems, detail, scheduled_date } = req.body;

  const { sql, params } = userFilter(req, "c", 1);
  const existing = await pool.query(
    `SELECT r.* FROM repair_requests r JOIN customers c ON c.customer_id = r.customer_id WHERE r.repair_id = $1${sql}`,
    [id, ...params]
  );
  if (!existing.rows.length) return res.status(404).json({ error: "ไม่พบคำร้องซ่อม" });

  const curProblems = typeof existing.rows[0].problems === "string" ? JSON.parse(existing.rows[0].problems) : existing.rows[0].problems;

  await pool.query(
    `UPDATE repair_requests SET well_id = $1, problems = $2, detail = $3, scheduled_date = $4 WHERE repair_id = $5`,
    [
      well_id ?? existing.rows[0].well_id,
      problems ? JSON.stringify(problems) : JSON.stringify(curProblems),
      detail ?? existing.rows[0].detail,
      scheduled_date ?? existing.rows[0].scheduled_date,
      id,
    ]
  );

  const result = await pool.query(
    `${REQUEST_SELECT} WHERE r.repair_id = $1`, [id]
  );
  broadcast({ type: "REPAIR_REQUEST_UPDATED", data: { repair_id: Number(id) }, orgId: req.user?.orgId });
  res.json(mapRow(result.rows[0]));
}

export async function updateStatus(req: Request, res: Response) {
  const { id } = req.params;
  const { status, scheduled_date } = req.body;

  const valid = ["NEW", "QUOTED", "ACCEPTED", "REJECTED", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CLOSED", "CANCELLED"];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `สถานะไม่ถูกต้อง ต้องเป็น ${valid.join(", ")}` });
  }

  const { sql, params } = userFilter(req, "c", 1);
  const existing = await pool.query(
    `SELECT r.repair_id, r.customer_id FROM repair_requests r JOIN customers c ON c.customer_id = r.customer_id WHERE r.repair_id = $1${sql}`,
    [id, ...params]
  );
  if (!existing.rows.length) return res.status(404).json({ error: "ไม่พบคำร้องซ่อม" });

  if (scheduled_date !== undefined) {
    await pool.query("UPDATE repair_requests SET status = $1, scheduled_date = $2 WHERE repair_id = $3", [status, scheduled_date, id]);
  } else {
    await pool.query("UPDATE repair_requests SET status = $1 WHERE repair_id = $2", [status, id]);
  }

  const { rows } = await pool.query(
    `${REQUEST_SELECT} WHERE r.repair_id = $1`, [id]
  );

  const customerId = rows[0].customer_id;
  if (customerId && status === "SCHEDULED") {
    const scheduledDate = rows[0].scheduled_date;
    const dateText = scheduledDate
      ? new Date(scheduledDate).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })
      : null;
    const msg = dateText
      ? `ทีมงานยืนยันวันนัดซ่อมบำรุงแล้วครับ\n\nวันนัด: ${dateText}\nกรุณาเตรียมตัวให้พร้อมครับ หากมีปัญหาสามารถติดต่อทีมงานได้เลยครับ`
      : "ทีมงานยืนยันการนัดซ่อมบำรุงแล้วครับ กรุณาเตรียมตัวให้พร้อมครับ";
    sendTextToCustomer(customerId, msg, "REMINDER", req.user?.orgId).catch(() => {});
  }
  if (customerId && status === "IN_PROGRESS") {
    sendTextToCustomer(customerId, "ขณะนี้ช่างกำลังดำเนินการซ่อมบำรุงให้ครับ กรุณารอสักครู่", "STATUS", req.user?.orgId).catch(() => {});
  }
  if (customerId && status === "CLOSED") {
    sendTextToCustomer(
      customerId,
      "การซ่อมบำรุงเสร็จเรียบร้อยแล้วครับ\n\nกรุณาส่งรูปสลิปโอนเงินมาในแชทนี้เลยครับ (กดรูป ได้เลย) หลังจากตรวจสอบแล้วจะแจ้งยืนยันการชำระเงินให้ครับ ขอบคุณครับ",
      "STATUS",
      req.user?.orgId
    ).catch(() => {});
  }

  broadcast({ type: "REPAIR_REQUEST_CHANGED", data: { repair_id: Number(id), status }, orgId: req.user?.orgId });
  res.json(mapRow(rows[0]));
}

export async function getByMagicToken(req: Request, res: Response) {
  const { token } = req.params;
  const { rows: dbRows } = await pool.query(
    `${REQUEST_SELECT} WHERE r.magic_link_token = $1
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

  const { rows } = await pool.query(
    `SELECT * FROM repair_requests
     WHERE repair_id = $1 AND (magic_link_expires_at IS NULL OR magic_link_expires_at > NOW())`,
    [id]
  );
  if (!rows.length) return res.status(404).json({ error: "ไม่พบคำร้องหรือลิงก์หมดอายุ" });
  if (magic_token && rows[0].magic_link_token !== magic_token) {
    return res.status(403).json({ error: "Token ไม่ถูกต้อง" });
  }

  const recResult = await pool.query(
    `INSERT INTO repair_records (repair_id, final_price, work_details, parts, pump, is_warranty_claim, completed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING record_id`,
    [
      id,
      final_price ?? null,
      work_details || null,
      parts?.length ? JSON.stringify(parts) : null,
      pump ? JSON.stringify(pump) : null,
      is_warranty_claim ? true : false,
      completed_at || new Date().toISOString().replace("T", " ").slice(0, 19),
    ]
  );

  await pool.query("UPDATE repair_requests SET status = 'COMPLETED' WHERE repair_id = $1", [id]);

  const recs = await pool.query(
    "SELECT * FROM repair_records WHERE record_id = $1", [recResult.rows[0].record_id]
  );

  const reqRow = await pool.query(
    "SELECT r.customer_id, c.org_id FROM repair_requests r JOIN customers c ON c.customer_id = r.customer_id WHERE r.repair_id = $1", [id]
  );
  if (reqRow.rows.length) {
    const orgId = reqRow.rows[0].org_id;
    broadcast({ type: "REPAIR_RECORD_ADDED", data: { repair_id: Number(id) }, orgId });
    broadcast({ type: "REPAIR_REQUEST_CHANGED", data: { repair_id: Number(id), status: "COMPLETED" }, orgId });
    const partsList = parts?.length
      ? "\nรายการอะไหล่: " + parts.map((p: any) => `${p.name} x${p.qty}`).join(", ")
      : "";
    const msg = final_price != null
      ? `แจ้งผลการซ่อมเสร็จเรียบร้อยแล้วครับ\n\nรายละเอียดงาน:\n${work_details || "-"}${partsList}\n\nราคาจบงาน ${Number(final_price).toLocaleString("th-TH")} บาท\n\nกรุณาอัปโหลดสลิปโอนเงินผ่านลิงก์ในแชทครับ`
      : `แจ้งผลการซ่อมเสร็จเรียบร้อยแล้วครับ\n\nรายละเอียดงาน:\n${work_details || "-"}${partsList}\n\nกรุณาอัปโหลดสลิปโอนเงินผ่านลิงก์ในแชทครับ`;
    sendTextToCustomer(reqRow.rows[0].customer_id, msg, "STATUS", orgId).catch(() => {});
  }

  res.status(201).json(recs.rows[0]);
}

export async function remove(req: Request, res: Response) {
  const { sql, params } = userFilter(req, "c", 1);
  const existing = await pool.query(
    `SELECT r.repair_id FROM repair_requests r JOIN customers c ON c.customer_id = r.customer_id WHERE r.repair_id = $1${sql}`,
    [req.params.id, ...params]
  );
  if (!existing.rows.length) return res.status(404).json({ error: "ไม่พบคำร้อง" });
  await pool.query("DELETE FROM repair_requests WHERE repair_id = $1", [req.params.id]);
  broadcast({ type: "REPAIR_REQUEST_DELETED", data: { repair_id: Number(req.params.id) }, orgId: req.user?.orgId });
  res.status(204).end();
}

export async function generateMagicLink(req: Request, res: Response) {
  const { id } = req.params;
  const { sql, params } = userFilter(req, "c", 1);
  const existing = await pool.query(
    `SELECT r.repair_id FROM repair_requests r JOIN customers c ON c.customer_id = r.customer_id WHERE r.repair_id = $1${sql}`,
    [req.params.id, ...params]
  );
  if (!existing.rows.length) return res.status(404).json({ error: "ไม่พบคำร้อง" });
  const token = generateMagicToken();
  await pool.query(
    "UPDATE repair_requests SET magic_link_token = $1, magic_link_expires_at = NOW() + INTERVAL '7 days' WHERE repair_id = $2",
    [token, id]
  );
  res.json({ token });
}

export async function listPaymentSlips(req: Request, res: Response) {
  const { id } = req.params;
  const { sql, params } = userFilter(req, "c", 1);
  const existing = await pool.query(
    `SELECT r.repair_id FROM repair_requests r JOIN customers c ON c.customer_id = r.customer_id WHERE r.repair_id = $1${sql}`,
    [id, ...params]
  );
  if (!existing.rows.length) return res.status(404).json({ error: "ไม่พบคำร้อง" });

  const { rows } = await pool.query(
    `SELECT * FROM payment_slips WHERE repair_id = $1 ORDER BY submitted_at DESC`,
    [id]
  );
  res.json(rows);
}

export async function verifyPaymentSlip(req: Request, res: Response) {
  const { id, slipId } = req.params;
  const { status, notes } = req.body;
  if (!["VERIFIED", "REJECTED"].includes(status)) {
    return res.status(400).json({ error: "สถานะต้องเป็น VERIFIED หรือ REJECTED" });
  }

  const { sql, params } = userFilter(req, "c", 1);
  const existing = await pool.query(
    `SELECT r.repair_id, r.customer_id, c.org_id
     FROM repair_requests r
     JOIN customers c ON c.customer_id = r.customer_id
     WHERE r.repair_id = $1${sql}`,
    [id, ...params]
  );
  if (!existing.rows.length) return res.status(404).json({ error: "ไม่พบคำร้อง" });

  const customerId = existing.rows[0].customer_id;
  const orgId = existing.rows[0].org_id;

  const result = await pool.query(
    `UPDATE payment_slips
     SET status = $1, notes = $2, verified_at = NOW()
     WHERE slip_id = $3 AND repair_id = $4
     RETURNING *`,
    [status, notes || null, slipId, id]
  );
  if (!result.rows.length) return res.status(404).json({ error: "ไม่พบสลิป" });

  // ส่งแจ้งเตือน LINE หาตามผลการตรวจสอบ
  if (customerId) {
    if (status === "VERIFIED") {
      sendTextToCustomer(
        customerId,
        "ได้รับการยืนยันการชำระเงินเรียบร้อยแล้วครับ ขอบคุณที่ไว้วางใจใช้บริการครับ",
        "STATUS",
        orgId
      ).catch(() => {});
    } else if (status === "REJECTED") {
      const reason = notes ? `\nเหตุผล: ${notes}` : "";
      sendTextToCustomer(
        customerId,
        `การตรวจสอบสลิปไม่ผ่าน${reason}\nกรุณาส่งรูปสลิปใหม่อีกครั้งในแชทนี้ครับ`,
        "STATUS",
        orgId
      ).catch(() => {});
    }
  }

  broadcast({
    type: "PAYMENT_SLIP_VERIFIED",
    data: { repair_id: id, slip_id: slipId, status },
    orgId: req.user?.orgId,
  });

  res.json(result.rows[0]);
}

