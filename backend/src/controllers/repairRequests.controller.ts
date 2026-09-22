import { Request, Response } from "express";
import crypto from "crypto";
import { pool } from "../config/db";
import { userFilter } from "../utils/userFilter";
import { RepairRequest } from "../types";
import { sendTextToCustomer, sendFlexToCustomer, buildRepairReceiptFlex } from "../services/line";
import { broadcast } from "../services/sse";
import { resolveOrgId } from "../utils/resolveOrg";
import { streamRepairReceiptPdf, ReceiptData } from "../utils/pdfReceipt";

function generateMagicToken(): string {
  return "repair-" + crypto.randomBytes(16).toString("hex");
}

function getReqBaseUrl(req: Request): string {
  if (process.env.API_BASE_URL) return process.env.API_BASE_URL.replace(/\/$/, "");
  if (process.env.BACKEND_URL) return process.env.BACKEND_URL.replace(/\/$/, "");
  if (process.env.APP_URL && !process.env.APP_URL.includes("5173")) {
    return process.env.APP_URL.replace(/\/$/, "");
  }
  const proto = (req.headers && (req.headers["x-forwarded-proto"] as string)) || req.protocol || "http";
  const host = (req.headers && (req.headers["x-forwarded-host"] as string)) || (typeof req.get === "function" ? req.get("host") : "") || `localhost:${process.env.PORT || 4000}`;
  return `${proto}://${host}`;
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
  const { name, phone, address, well_id, well_name, problems, detail, photos, scheduled_date, line_user_id, line_display_name, line_picture_url, liff_id } = req.body;
  if (!name || !phone || !problems?.length) {
    return res.status(400).json({ error: "ต้องระบุชื่อ, เบอร์โทร และปัญหาที่พบ" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const resolvedOrgId = await resolveOrgId(client, liff_id, "repair");
    if (!resolvedOrgId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: "LIFF นี้ไม่ได้ผูกกับองค์กรสำหรับแจ้งซ่อม" });
    }

    let customerId: number;

    let existing;
    if (line_user_id) {
      existing = resolvedOrgId
        ? await client.query(
            "SELECT customer_id FROM customers WHERE line_user_id = $1 AND org_id = $2 LIMIT 1",
            [line_user_id, resolvedOrgId]
          )
        : null;
    }
    if (!existing?.rows.length) {
      existing = resolvedOrgId
        ? await client.query(
            "SELECT customer_id FROM customers WHERE phone = $1 AND org_id = $2 LIMIT 1",
            [phone, resolvedOrgId]
          )
        : null;
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

    let resolvedWellId: string | null = null;
    if (well_id) {
      const wellCheck = await client.query(
        "SELECT well_id FROM wells WHERE well_id = $1 AND customer_id = $2", [well_id, customerId]
      );
      resolvedWellId = wellCheck.rows[0]?.well_id || null;
    }
    if (!resolvedWellId) {
      const wells = await client.query(
        "SELECT well_id FROM wells WHERE customer_id = $1 ORDER BY created_at DESC LIMIT 1", [customerId]
      );
      resolvedWellId = wells.rows[0]?.well_id || null;
    }

    const combinedDetail = well_name
      ? `บ่อ: ${well_name}${detail ? `\n${detail}` : ""}`
      : (detail || null);

    const r = await client.query(
      `INSERT INTO repair_requests (customer_id, well_id, problems, detail, photos, scheduled_date, magic_link_token, magic_link_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW() + INTERVAL '7 days')
       RETURNING repair_id`,
      [customerId, resolvedWellId, JSON.stringify(problems), combinedDetail, photos?.length ? JSON.stringify(photos) : null, scheduled_date || null, generateMagicToken()]
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
  broadcast({ type: "REPAIR_REQUEST_UPDATED", data: { repair_id: id }, orgId: req.user?.orgId });
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
      "การซ่อมบำรุงเสร็จเรียบร้อยแล้วครับ ขอบคุณที่ใช้บริการครับ",
      "STATUS",
      req.user?.orgId
    ).catch(() => {});
  }
  if (customerId && status === "COMPLETED") {
    const recCheck = await pool.query(
      "SELECT * FROM repair_records WHERE repair_id = $1 ORDER BY completed_at DESC, created_at DESC LIMIT 1",
      [id]
    );
    if (recCheck.rows.length) {
      const rec = recCheck.rows[0];
      const baseUrl = getReqBaseUrl(req);
      const pdfUrl = `${baseUrl.replace(/\/$/, "")}/api/public/repairs/${id}/receipt.pdf`;
      const dateStr = (rec.completed_at ? new Date(rec.completed_at) : new Date()).toISOString().slice(0, 10).replace(/-/g, "");
      const receiptNo = `REC-${dateStr}-${String(id).slice(-4).toUpperCase()}`;
      let partsList: any[] = [];
      try { partsList = typeof rec.parts === "string" ? JSON.parse(rec.parts) : (rec.parts || []); } catch {}
      const flex = buildRepairReceiptFlex({
        receiptNo,
        customerName: rows[0].customer_name,
        repairId: id,
        wellName: rows[0].well_name,
        workDetails: rec.work_details,
        parts: partsList,
        finalPrice: rec.final_price,
        isWarrantyClaim: Boolean(rec.is_warranty_claim),
        pdfUrl,
      });
      sendFlexToCustomer(customerId, "ใบเสร็จรับเงินการซ่อมบำรุง", flex, "STATUS", req.user?.orgId).catch(() => {});
    }
  }

  broadcast({ type: "REPAIR_REQUEST_CHANGED", data: { repair_id: id, status }, orgId: req.user?.orgId });
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

  const client = await pool.connect();
  let recordId: string;
  let isNewRecord: boolean;
  try {
    await client.query("BEGIN");

    // ล็อกแถวคำร้องนี้ไว้จนกว่า transaction จะจบ ป้องกันการ submit ซ้ำ (เช่น ช่างกดส่งฟอร์มซ้ำ
    // หรือเปิดลิงก์เดิมส่งซ้ำ) ทำให้เกิดบันทึกการซ่อมซ้ำสองรายการจากคำขอที่แข่งกันมาพร้อมกัน
    const { rows } = await client.query(
      `SELECT * FROM repair_requests
       WHERE repair_id = $1 AND (magic_link_expires_at IS NULL OR magic_link_expires_at > NOW())
       FOR UPDATE`,
      [id]
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "ไม่พบคำร้องหรือลิงก์หมดอายุ" });
    }
    if (magic_token && rows[0].magic_link_token !== magic_token) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Token ไม่ถูกต้อง" });
    }

    // คำร้องที่ปิดงานแล้ว (CLOSED) ถือว่าจบกระบวนการแล้ว ลิงก์เก่าที่เคยส่งให้ช่างต้องใช้
    // บันทึก/แก้ไขข้อมูลไม่ได้อีกต่อไป แม้ magic_link_expires_at จะยังไม่หมดอายุก็ตาม
    if (rows[0].status === "CLOSED") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "คำร้องนี้ปิดงานแล้ว ไม่สามารถบันทึกข้อมูลผ่านลิงก์นี้ได้อีก กรุณาแก้ไขข้อมูลผ่านหน้าประวัติการซ่อมแทน",
      });
    }

    const existingRecord = await client.query(
      "SELECT record_id FROM repair_records WHERE repair_id = $1 ORDER BY created_at DESC LIMIT 1",
      [id]
    );
    const completedAtValue = completed_at || new Date().toISOString().replace("T", " ").slice(0, 19);
    const partsJson = parts?.length ? JSON.stringify(parts) : null;
    const pumpJson = pump ? JSON.stringify(pump) : null;

    if (existingRecord.rows.length) {
      isNewRecord = false;
      recordId = existingRecord.rows[0].record_id;
      await client.query(
        `UPDATE repair_records SET
           final_price = $1, work_details = $2, parts = $3, pump = $4, is_warranty_claim = $5, completed_at = $6
         WHERE record_id = $7`,
        [final_price ?? null, work_details || null, partsJson, pumpJson, is_warranty_claim ? true : false, completedAtValue, recordId]
      );
    } else {
      isNewRecord = true;
      const recResult = await client.query(
        `INSERT INTO repair_records (repair_id, final_price, work_details, parts, pump, is_warranty_claim, completed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING record_id`,
        [id, final_price ?? null, work_details || null, partsJson, pumpJson, is_warranty_claim ? true : false, completedAtValue]
      );
      recordId = recResult.rows[0].record_id;
    }

    await client.query("UPDATE repair_requests SET status = 'COMPLETED' WHERE repair_id = $1", [id]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const recs = await pool.query(
    "SELECT * FROM repair_records WHERE record_id = $1", [recordId]
  );

  const reqRow = await pool.query(
    "SELECT r.customer_id, r.well_id, w.well_name, c.customer_name, c.org_id FROM repair_requests r JOIN customers c ON c.customer_id = r.customer_id LEFT JOIN wells w ON w.well_id = r.well_id WHERE r.repair_id = $1",
    [id]
  );
  if (reqRow.rows.length) {
    const cust = reqRow.rows[0];
    const orgId = cust.org_id;
    broadcast({ type: isNewRecord ? "REPAIR_RECORD_ADDED" : "REPAIR_RECORD_UPDATED", data: { repair_id: id }, orgId });
    broadcast({ type: "REPAIR_REQUEST_CHANGED", data: { repair_id: id, status: "COMPLETED" }, orgId });

    // ส่งใบเสร็จ/แจ้งเตือนลูกค้าทาง LINE เฉพาะตอนที่เป็นการบันทึกครั้งแรกจริงๆ เท่านั้น
    // ถ้าช่างเปิดลิงก์เดิมส่งฟอร์มซ้ำ (แก้ไขบันทึกที่มีอยู่แล้ว) ไม่ควรแจ้งเตือนลูกค้าซ้ำ
    if (isNewRecord) {
      const baseUrl = getReqBaseUrl(req);
      const pdfUrl = `${baseUrl.replace(/\/$/, "")}/api/public/repairs/${id}/receipt.pdf`;
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const receiptNo = `REC-${dateStr}-${String(id).slice(-4).toUpperCase()}`;

      const receiptFlex = buildRepairReceiptFlex({
        receiptNo,
        customerName: cust.customer_name,
        repairId: id,
        wellName: cust.well_name,
        workDetails: work_details,
        parts: parts,
        finalPrice: final_price,
        isWarrantyClaim: Boolean(is_warranty_claim),
        pdfUrl,
      });

      sendFlexToCustomer(cust.customer_id, "ใบเสร็จรับเงินการซ่อมบำรุง", receiptFlex, "STATUS", orgId).catch(() => {
        const partsList = parts?.length
          ? "\nรายการอะไหล่: " + parts.map((p: any) => `${p.name} x${p.qty}`).join(", ")
          : "";
        const msg = final_price != null
          ? `แจ้งผลการซ่อมเสร็จเรียบร้อยแล้วครับ\n\nรายละเอียดงาน:\n${work_details || "-"}${partsList}\n\nราคาจบงาน ${Number(final_price).toLocaleString("th-TH")} บาท\n\nดาวน์โหลดใบเสร็จ (PDF):\n${pdfUrl}`
          : `แจ้งผลการซ่อมเสร็จเรียบร้อยแล้วครับ\n\nรายละเอียดงาน:\n${work_details || "-"}${partsList}\n\nดาวน์โหลดใบเสร็จ (PDF):\n${pdfUrl}`;
        sendTextToCustomer(cust.customer_id, msg, "STATUS", orgId).catch(() => {});
      });
    }
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
  await pool.query(
    "DELETE FROM quotations WHERE kind = 'REPAIR' AND repair_request_id = $1",
    [req.params.id]
  );
  await pool.query("DELETE FROM repair_requests WHERE repair_id = $1", [req.params.id]);
  broadcast({ type: "REPAIR_REQUEST_DELETED", data: { repair_id: req.params.id }, orgId: req.user?.orgId });
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
  const recCheck = await pool.query("SELECT record_id FROM repair_records WHERE repair_id = $1 LIMIT 1", [id]);
  if (recCheck.rows.length) {
    return res.status(409).json({
      error: "คำร้องนี้บันทึกผลการซ่อมเรียบร้อยแล้ว ไม่สามารถสร้างลิงก์ใหม่ได้ กรุณาแก้ไขข้อมูลผ่านหน้าประวัติการซ่อมแทน",
    });
  }
  const token = generateMagicToken();
  await pool.query(
    "UPDATE repair_requests SET magic_link_token = $1, magic_link_expires_at = NOW() + INTERVAL '7 days' WHERE repair_id = $2",
    [token, id]
  );
  broadcast({ type: "REPAIR_MAGIC_LINK_CHANGED", data: { repair_id: id, token }, orgId: req.user?.orgId });
  res.json({ token });
}

export async function exportReceipt(req: Request, res: Response) {
  const { id } = req.params;
  const orgId = req.user?.orgId;
  const orgClause = orgId ? ` AND c.org_id = $2` : "";
  const params = orgId ? [id, orgId] : [id];

  const { rows } = await pool.query(`
    SELECT
      r.*,
      c.customer_name,
      c.phone AS customer_phone,
      c.address AS customer_address,
      w.well_name,
      o.name AS org_name
    FROM repair_requests r
    JOIN customers c ON c.customer_id = r.customer_id
    LEFT JOIN wells w ON w.well_id = r.well_id
    LEFT JOIN organizations o ON o.org_id = c.org_id
    WHERE r.repair_id = $1${orgClause}
  `, params);

  if (!rows.length) return res.status(404).json({ error: "ไม่พบข้อมูลคำร้องซ่อม" });
  const r = rows[0];

  const recResult = await pool.query(
    "SELECT * FROM repair_records WHERE repair_id = $1 ORDER BY completed_at DESC, created_at DESC LIMIT 1",
    [id]
  );
  const rec = recResult.rows[0] || {};

  let problems: string[] = [];
  if (Array.isArray(r.problems)) problems = r.problems.map(String);
  else if (typeof r.problems === "string") {
    try { problems = JSON.parse(r.problems); } catch {}
  }

  let parts: any[] = [];
  if (Array.isArray(rec.parts)) parts = rec.parts;
  else if (typeof rec.parts === "string") {
    try { parts = JSON.parse(rec.parts); } catch {}
  }

  let pump: any = null;
  if (rec.pump && typeof rec.pump === "object") pump = rec.pump;
  else if (typeof rec.pump === "string") {
    try { pump = JSON.parse(rec.pump); } catch {}
  }

  const completedDate = rec.completed_at || r.updated_at || r.created_at;
  const dateStr = completedDate ? new Date(completedDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const receiptNo = `REC-${dateStr.replace(/-/g, "")}-${String(id).slice(-4).toUpperCase()}`;

  const receiptData: ReceiptData = {
    receipt_no: receiptNo,
    issued_date: dateStr,
    org_name: r.org_name || "บริการขุดเจาะและซ่อมบำรุงบ่อบาดาล",
    customer_name: r.customer_name || "ลูกค้า",
    customer_phone: r.customer_phone || "",
    customer_address: r.customer_address || "",
    repair_id: id,
    well_id: r.well_id,
    well_name: r.well_name,
    problems,
    work_details: rec.work_details || r.detail,
    parts,
    pump,
    is_warranty_claim: Boolean(rec.is_warranty_claim),
    final_price: rec.final_price != null ? Number(rec.final_price) : null,
    status: r.status,
  };

  streamRepairReceiptPdf(res, receiptData);
}

export async function sendReceiptToCustomer(req: Request, res: Response) {
  const { id } = req.params;
  const { sql, params } = userFilter(req, "c", 1);
  const { rows } = await pool.query(`
    SELECT
      r.repair_id, r.customer_id, r.well_id, r.problems, r.detail,
      c.customer_name, c.org_id,
      w.well_name
    FROM repair_requests r
    JOIN customers c ON c.customer_id = r.customer_id
    LEFT JOIN wells w ON w.well_id = r.well_id
    WHERE r.repair_id = $1${sql}
  `, [id, ...params]);

  if (!rows.length) return res.status(404).json({ error: "ไม่พบคำร้องซ่อม" });
  const r = rows[0];

  const recResult = await pool.query(
    "SELECT * FROM repair_records WHERE repair_id = $1 ORDER BY completed_at DESC, created_at DESC LIMIT 1",
    [id]
  );
  if (!recResult.rows.length) {
    return res.status(400).json({ error: "ยังไม่มีบันทึกการซ่อม ไม่สามารถออกใบเสร็จได้" });
  }
  const rec = recResult.rows[0];

  let parts: any[] = [];
  if (Array.isArray(rec.parts)) parts = rec.parts;
  else if (typeof rec.parts === "string") {
    try { parts = JSON.parse(rec.parts); } catch {}
  }

  const baseUrl = getReqBaseUrl(req);
  const pdfUrl = `${baseUrl.replace(/\/$/, "")}/api/public/repairs/${id}/receipt.pdf`;
  const dateStr = (rec.completed_at ? new Date(rec.completed_at) : new Date()).toISOString().slice(0, 10).replace(/-/g, "");
  const receiptNo = `REC-${dateStr}-${String(id).slice(-4).toUpperCase()}`;

  const flex = buildRepairReceiptFlex({
    receiptNo,
    customerName: r.customer_name,
    repairId: id,
    wellName: r.well_name,
    workDetails: rec.work_details || r.detail,
    parts,
    finalPrice: rec.final_price,
    isWarrantyClaim: Boolean(rec.is_warranty_claim),
    pdfUrl,
  });

  const ok = await sendFlexToCustomer(r.customer_id, "ใบเสร็จรับเงินการซ่อมบำรุง", flex, "STATUS", r.org_id);
  if (!ok) {
    await sendTextToCustomer(
      r.customer_id,
      `ใบเสร็จรับเงินการซ่อมบำรุง เลขที่ ${receiptNo}\nสามารถดาวน์โหลดใบเสร็จ (PDF) ได้ที่:\n${pdfUrl}`,
      "STATUS",
      r.org_id
    ).catch(() => {});
  }

  res.json({ ok: true, message: "ส่งใบเสร็จให้ลูกค้าผ่าน LINE สำเร็จ" });
}


