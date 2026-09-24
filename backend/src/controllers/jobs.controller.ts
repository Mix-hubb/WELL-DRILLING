import { Request, Response } from "express";
import crypto from "crypto";
import { pool } from "../config/db";
import { userFilter } from "../utils/userFilter";
import { DrillingJob } from "../types";
import { sendTextToCustomer } from "../services/line";
import { validateStrataList } from "../utils/strataValidation";
import { broadcast } from "../services/sse";

function generateMagicToken(): string {
  return "drill-" + crypto.randomBytes(16).toString("hex");
}

async function getJobRow(id: string, orgId?: string | null): Promise<any | null> {
  const orgClause = orgId ? ` AND c.org_id = $2` : "";
  const params = orgId ? [id, orgId] : [id];
  const { rows } = await pool.query(`
    SELECT
      j.*,
      c.customer_name,
      c.phone AS customer_phone,
      c.line_picture_url,
      w.well_name,
      w.warranty_expire_date
    FROM drilling_jobs j
    JOIN customers c ON c.customer_id = j.customer_id
    LEFT JOIN wells w ON w.well_id = j.well_id
    WHERE j.job_id = $1${orgClause}
  `, params);
  return rows[0] || null;
}

export async function list(req: Request, res: Response) {
  const { status } = req.query;
  const whereParams: any[] = [];
  let where = "1=1";
  if (status && status !== "ALL") {
    where += " AND j.status = $1";
    whereParams.push(status);
  }

  const { sql, params } = userFilter(req, "c", whereParams.length);

  const { rows } = await pool.query(`
    SELECT
      j.*,
      c.customer_name,
      c.phone AS customer_phone,
      c.line_picture_url,
      w.well_name,
      w.warranty_expire_date
    FROM drilling_jobs j
    JOIN customers c ON c.customer_id = j.customer_id
    LEFT JOIN wells w ON w.well_id = j.well_id
    WHERE ${where} AND j.status != 'ARCHIVED' ${sql}
    ORDER BY j.created_at DESC
  `, [...whereParams, ...params]);

  res.json(rows as DrillingJob[]);
}

export async function getOne(req: Request, res: Response) {
  const { id } = req.params;
  const orgId = req.user?.orgId;
  const row = await getJobRow(id, orgId);
  if (!row) return res.status(404).json({ error: "ไม่พบงานเจาะ" });

  let request = null;
  if (row.request_id) {
    const reqResult = await pool.query(
      `SELECT r.* FROM drilling_requests r WHERE r.request_id = $1`, [row.request_id]
    );
    if (reqResult.rows.length) {
      request = reqResult.rows[0];
      if (request.quotation_id) {
        const quoteResult = await pool.query(
          "SELECT * FROM quotations WHERE drilling_request_id = $1 ORDER BY created_at DESC LIMIT 1",
          [request.request_id]
        );
        if (quoteResult.rows.length) request.quotation = quoteResult.rows[0];
      }
    }
  }

  res.json({ ...row, request });
}

export async function getByMagicToken(req: Request, res: Response) {
  const { token } = req.params;
  const { rows } = await pool.query(`
    SELECT
      j.*,
      c.customer_name,
      c.phone AS customer_phone,
      c.line_picture_url,
      w.well_name,
      w.warranty_expire_date
    FROM drilling_jobs j
    JOIN customers c ON c.customer_id = j.customer_id
    LEFT JOIN wells w ON w.well_id = j.well_id
    WHERE j.magic_link_token = $1
      AND (j.magic_link_expires_at IS NULL OR j.magic_link_expires_at > NOW())
  `, [token]);
  if (!rows.length) return res.status(404).json({ error: "ลิงก์ไม่ถูกต้องหรือหมดอายุ" });
  res.json(rows[0] as DrillingJob);
}

export async function create(req: Request, res: Response) {
  const {
    request_id,
    customer_id,
    job_title,
    site_address,
    province,
    district,
    scheduled_date,
    notes,
  } = req.body;

  if (!customer_id) {
    return res.status(400).json({ error: "ต้องระบุ customer_id" });
  }

  const { sql, params } = userFilter(req, "c", 1);
  const ownershipCheck = await pool.query(
    `SELECT c.customer_id FROM customers c WHERE c.customer_id = $1${sql}`,
    [customer_id, ...params]
  );
  if (!ownershipCheck.rows.length) {
    return res.status(404).json({ error: "ไม่พบลูกค้าหรือไม่มีสิทธิ์เข้าถึง" });
  }

  if (request_id) {
    const requestCheck = await pool.query(
      `SELECT r.status, j.job_id
       FROM drilling_requests r
       JOIN customers c ON c.customer_id = r.customer_id
       LEFT JOIN drilling_jobs j ON j.request_id = r.request_id
       WHERE r.request_id = $1 AND r.customer_id = $2 AND c.org_id = $3`,
      [request_id, customer_id, req.user?.orgId]
    );
    if (!requestCheck.rows.length) {
      return res.status(404).json({ error: "ไม่พบคำร้องเจาะของลูกค้าหรือไม่มีสิทธิ์เข้าถึง" });
    }
    if (requestCheck.rows[0].job_id || !["NEW", "QUOTED", "ACCEPTED"].includes(requestCheck.rows[0].status)) {
      return res.status(409).json({ error: "คำร้องนี้มีคิวงานหรือถูกปิดแล้ว ไม่สามารถสร้างคิวงานซ้ำได้" });
    }
  }

  const token = generateMagicToken();
  const { rows } = await pool.query(
    `INSERT INTO drilling_jobs
      (request_id, customer_id, job_title, site_address, province, district, scheduled_date, notes, magic_link_token, magic_link_expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() + INTERVAL '7 days')
     RETURNING job_id`,
    [request_id || null, customer_id, job_title || null, site_address || null, province || null, district || null, scheduled_date || null, notes || null, token]
  );

  const newJobId = rows[0].job_id;

  if (request_id) {
    await pool.query("UPDATE drilling_requests SET status = 'ACCEPTED' WHERE request_id = $1", [request_id]);
  }

  const row = await getJobRow(newJobId, req.user?.orgId);
  broadcast({ type: "JOB_CREATED", data: { job_id: newJobId }, orgId: req.user?.orgId });
  res.status(201).json(row);
}

export async function update(req: Request, res: Response) {
  const { id } = req.params;
  const { job_title, site_address, province, district, scheduled_date, notes } = req.body;

  const existing = await getJobRow(id, req.user?.orgId);
  if (!existing) return res.status(404).json({ error: "ไม่พบงาน" });

  await pool.query(
    `UPDATE drilling_jobs SET job_title = $1, site_address = $2, province = $3, district = $4, scheduled_date = $5, notes = $6 WHERE job_id = $7`,
    [
      job_title ?? existing.job_title,
      site_address ?? existing.site_address,
      province ?? existing.province,
      district ?? existing.district,
      scheduled_date ?? existing.scheduled_date,
      notes ?? existing.notes,
      id,
    ]
  );

  const row = await getJobRow(id, req.user?.orgId);
  broadcast({ type: "JOB_UPDATED", data: { job_id: id }, orgId: req.user?.orgId });
  res.json(row);
}
export async function updateStatus(req: Request, res: Response) {
  const { id } = req.params;
  const { status } = req.body;

  const valid = ["QUEUED", "DRILLING", "SUCCESS", "FAILED", "CLOSED"];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `สถานะไม่ถูกต้อง ต้องเป็น ${valid.join(", ")}` });
  }

  const existing = await getJobRow(id, req.user?.orgId);
  if (!existing) return res.status(404).json({ error: "ไม่พบงานเจาะ" });

  // เก็บผลลัพธ์ (SUCCESS/FAILED) แยกไว้ใน result เพื่อให้ยังรู้ผลเจาะเดิมได้แม้ status จะกลายเป็น CLOSED ภายหลัง
  if (status === "SUCCESS" || status === "FAILED") {
    await pool.query("UPDATE drilling_jobs SET status = $1, result = $1 WHERE job_id = $2", [status, id]);
  } else {
    await pool.query("UPDATE drilling_jobs SET status = $1 WHERE job_id = $2", [status, id]);
  }
  const row = await getJobRow(id, req.user?.orgId);
  broadcast({ type: "JOB_STATUS_CHANGED", data: { job_id: id, status, customer_id: existing.customer_id }, orgId: req.user?.orgId });
  res.json(row);
}

export async function completeWell(req: Request, res: Response) {
  const { id } = req.params;
  const {
    magic_token,
    well_name,
    total_depth_m,
    requested_depth_m,
    drilling_method,
    formation_water_type,
    water_quantity_m3hr,
    driller_name,
    completion_date,
    result,
    failure_reason,
    notes,
    strata,
    pipes,
    pumps,
    control_boxes,
  } = req.body;

  if (Array.isArray(strata)) {
    const validRanges = strata
      .filter((s: any) => s.depth_from_m != null && s.depth_to_m != null)
      .map((s: any) => ({ depth_from_m: Number(s.depth_from_m), depth_to_m: Number(s.depth_to_m) }));
    const validationError = validateStrataList(validRanges, total_depth_m != null ? Number(total_depth_m) : null);
    if (validationError) return res.status(400).json({ error: validationError });
  }

  const client = await pool.connect();
  let wellId: number;
  let job: any;
  try {
    await client.query("BEGIN");

    // ล็อกแถวงานนี้ไว้จนกว่า transaction จะจบ ป้องกันการ submit ซ้ำ (เช่น driller
    // กดส่งฟอร์มซ้ำ หรือเปิดลิงก์เดิมส่งซ้ำ) ทำให้เกิดบ่อซ้ำสองรายการจากคำขอที่แข่งกันมาพร้อมกัน
    const jobs = await client.query(
      `SELECT * FROM drilling_jobs
       WHERE job_id = $1 AND (magic_link_expires_at IS NULL OR magic_link_expires_at > NOW())
       FOR UPDATE`,
      [id]
    );
    if (!jobs.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "ไม่พบงานหรือลิงก์หมดอายุ" });
    }
    job = jobs.rows[0];

    if (magic_token && job.magic_link_token !== magic_token) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "Token ไม่ถูกต้อง" });
    }

    // งานที่ปิดคิวแล้ว (CLOSED) ถือว่าจบกระบวนการแล้ว ลิงก์เก่าที่เคยส่งให้ช่างต้องใช้
    // บันทึก/แก้ไขข้อมูลไม่ได้อีกต่อไป แม้ magic_link_expires_at จะยังไม่หมดอายุก็ตาม —
    // ป้องกันไม่ให้ช่างเปิดลิงก์เก่าของงานที่ปิดไปแล้วมากรอกข้อมูลซ้ำจนงานถูกเปิดขึ้นมาใหม่
    if (job.status === "CLOSED") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "งานนี้ปิดคิวแล้ว ไม่สามารถบันทึกข้อมูลผ่านลิงก์นี้ได้อีก กรุณาแก้ไขข้อมูลผ่านหน้าประวัติบ่อบาดาลแทน",
      });
    }

    // เคยบันทึกผลผ่านลิงก์นี้ไปแล้วครั้งหนึ่ง (well_id ถูกตั้งค่าแล้ว) ล็อกไม่ให้กรอกซ้ำอีก
    // ฟอร์มของช่างเริ่มจากช่องว่างทุกครั้ง ไม่ได้โหลดข้อมูลเดิมมาให้แก้ การกรอกซ้ำจึงเสี่ยง
    // เขียนทับข้อมูลชุดที่ถูกต้องแล้วด้วยข้อมูลใหม่ที่อาจตกหล่น — การแก้ไขหลังจากนี้ให้เป็น
    // หน้าที่ของผู้ดูแลระบบผ่านหน้าเว็บ (ประวัติบ่อบาดาล) แทน
    if (job.well_id) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        error: "งานนี้บันทึกข้อมูลไปแล้ว ไม่สามารถกรอกซ้ำผ่านลิงก์นี้ได้อีก กรุณาแก้ไขข้อมูลผ่านหน้าประวัติบ่อบาดาลแทน",
      });
    }

    const wellResult = (result === "FAIL" || result === "FAILED") ? "FAIL" : "SUCCESS";
    const w = await client.query(
      `INSERT INTO wells
        (customer_id, well_name, total_depth_m, requested_depth_m, drilling_method, formation_water_type,
         water_quantity_m3hr, driller_name, completion_date,
         result, failure_reason, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING well_id`,
      [
        job.customer_id,
        well_name || `บ่อลูกค้า #${job.customer_id}`,
        total_depth_m ?? null,
        requested_depth_m ?? null,
        drilling_method || null,
        formation_water_type || "UNKNOWN",
        water_quantity_m3hr ?? null,
        driller_name || null,
        completion_date || new Date().toISOString().slice(0, 10),
        wellResult,
        failure_reason || null,
        notes || null,
      ]
    );
    wellId = w.rows[0].well_id;

    // wells.result เก็บเป็น 'SUCCESS'/'FAIL' แต่ drilling_jobs.status และ drilling_jobs.result เก็บเป็น 'SUCCESS'/'FAILED'
    const jobStatusValue = wellResult === "FAIL" ? "FAILED" : "SUCCESS";
    await client.query(
      "UPDATE drilling_jobs SET well_id = $1, status = $2, result = $3 WHERE job_id = $4",
      [wellId, jobStatusValue, jobStatusValue, id]
    );

    if (Array.isArray(strata)) {
      for (const s of strata) {
        if (s.depth_from_m == null || s.depth_to_m == null) continue;
        await client.query(
          `INSERT INTO well_strata_logs
            (well_id, depth_from_m, depth_to_m, lithology_type, lithology_name, color_hex, hardness, water_bearing, description)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            wellId, s.depth_from_m, s.depth_to_m,
            s.lithology_type || null, s.lithology_name || null, s.color_hex || null,
            s.hardness || null, s.water_bearing ? true : false, s.description || null,
          ]
        );
      }
    }

    if (Array.isArray(pipes)) {
      for (const p of pipes) {
        if (p.depth_from_m == null || p.depth_to_m == null) continue;
        await client.query(
          `INSERT INTO well_pipes (well_id, material, pipe_type, size_mm, depth_from_m, depth_to_m, quantity, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [wellId, p.material || null, p.pipe_type || null, p.size_mm ?? null, p.depth_from_m, p.depth_to_m, p.quantity || 1, p.notes || null]
        );
      }
    }

    if (Array.isArray(pumps)) {
      for (const p of pumps) {
        await client.query(
          `INSERT INTO well_pumps
            (well_id, pump_type, brand, pump_model, horsepower, power_kw, impeller_stages, installation_depth_m,
             voltage, phase, discharge_size_mm, rated_flow_m3hr, rated_head_m, installed_date, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            wellId, p.pump_type || null, p.brand || null, p.pump_model || null, p.horsepower ?? null,
            p.power_kw ?? null, p.impeller_stages ?? null, p.installation_depth_m ?? null, p.voltage || null,
            p.phase ?? null, p.discharge_size_mm ?? null, p.rated_flow_m3hr ?? null, p.rated_head_m ?? null,
            p.installed_date || null, p.notes || null,
          ]
        );
      }
    }

    if (Array.isArray(control_boxes)) {
      for (const c of control_boxes) {
        await client.query(
          `INSERT INTO well_control_boxes (well_id, brand, model, capacity, voltage, protection_type, features, installed_date, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [wellId, c.brand || null, c.model || null, c.capacity || null, c.voltage || null, c.protection_type || null, c.features || null, c.installed_date || null, c.notes || null]
        );
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  const row = await getJobRow(id);

  const { rows: orgRows } = await pool.query(
    "SELECT org_id FROM customers WHERE customer_id = $1", [job.customer_id]
  );
  const orgId = orgRows[0]?.org_id;

  // ผ่านการล็อกกันกรอกซ้ำด้านบนมาแล้ว จุดนี้จึงเป็นการบันทึกครั้งแรกของงานนี้เสมอ
  const wellResult = (result === "FAIL" || result === "FAILED") ? "FAILED" : "SUCCESS";
  const msg = wellResult === "SUCCESS"
    ? `แจ้งผลการเจาะ: เจาะสำเร็จแล้ว บ่อ ${row?.well_name || ""}\nข้อมูลอยู่ในระบบแล้วครับ`
    : "แจ้งผลการเจาะ: การเจาะไม่สำเร็จ กรุณาติดต่อช่างเพื่อหารือแนวทางต่อไปครับ";
  sendTextToCustomer(job.customer_id, msg, "STATUS", orgId).catch(() => {});
  broadcast({ type: "WELL_CREATED", data: { well_id: wellId, customer_id: job.customer_id }, orgId });
  broadcast({ type: "JOB_STATUS_CHANGED", data: { job_id: id, status: row?.status, customer_id: job.customer_id }, orgId });

  res.json(row);
}

export async function remove(req: Request, res: Response) {
  const orgId = req.user?.orgId;
  const { sql, params } = userFilter(req, "c", 1);
  const existing = await pool.query(
    `SELECT j.job_id FROM drilling_jobs j JOIN customers c ON c.customer_id = j.customer_id WHERE j.job_id = $1${sql}`,
    [req.params.id, ...params]
  );
  if (!existing.rows.length) return res.status(404).json({ error: "ไม่พบงาน" });
  await pool.query("DELETE FROM drilling_jobs WHERE job_id = $1", [req.params.id]);
  broadcast({ type: "JOB_DELETED", data: { job_id: req.params.id }, orgId });
  res.status(204).end();
}

export async function generateMagicLink(req: Request, res: Response) {
  const { id } = req.params;
  const { sql, params } = userFilter(req, "c", 1);
  const existing = await pool.query(
    `SELECT j.job_id, j.well_id FROM drilling_jobs j JOIN customers c ON c.customer_id = j.customer_id WHERE j.job_id = $1${sql}`,
    [req.params.id, ...params]
  );
  if (!existing.rows.length) return res.status(404).json({ error: "ไม่พบงาน" });
  if (existing.rows[0].well_id) {
    return res.status(409).json({
      error: "งานนี้บันทึกข้อมูลบ่อเรียบร้อยแล้ว ไม่สามารถสร้างลิงก์ใหม่ได้ กรุณาแก้ไขข้อมูลผ่านหน้าประวัติบ่อบาดาลแทน",
    });
  }
  const token = generateMagicToken();
  await pool.query(
    "UPDATE drilling_jobs SET magic_link_token = $1, magic_link_expires_at = NOW() + INTERVAL '7 days' WHERE job_id = $2",
    [token, id]
  );
  broadcast({ type: "JOB_MAGIC_LINK_CHANGED", data: { job_id: id, token }, orgId: req.user?.orgId });
  res.json({ token });
}
