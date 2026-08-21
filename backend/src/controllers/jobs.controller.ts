import { Request, Response } from "express";
import crypto from "crypto";
import { pool } from "../config/db";
import { userFilter } from "../utils/userFilter";
import { DrillingJob } from "../types";
import { sendTextToCustomer } from "../services/line";
import { broadcast } from "../services/sse";

function generateMagicToken(): string {
  return "drill-" + crypto.randomBytes(16).toString("hex");
}

async function getJobRow(id: string): Promise<any | null> {
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
    WHERE j.job_id = $1
  `, [id]);
  return rows[0] || null;
}

export async function list(req: Request, res: Response) {
  const { status } = req.query;
  const { sql, params } = userFilter(req);

  let where = "1=1";
  const whereParams: any[] = [];
  if (status && status !== "ALL") {
    where += " AND j.status = $1";
    whereParams.push(status);
  }

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
  const row = await getJobRow(id);
  if (!row) return res.status(404).json({ error: "ไม่พบงานเจาะ" });

  let request = null;
  if (row.request_id) {
    const reqResult = await pool.query(
      "SELECT * FROM drilling_requests WHERE request_id = $1", [row.request_id]
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

  const row = await getJobRow(newJobId);
  broadcast({ type: "JOB_CREATED", data: { job_id: newJobId } });
  res.status(201).json(row);
}

export async function update(req: Request, res: Response) {
  const { id } = req.params;
  const { job_title, site_address, province, district, scheduled_date, notes } = req.body;

  const existing = await getJobRow(id);
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

  const row = await getJobRow(id);
  res.json(row);
}

export async function updateStatus(req: Request, res: Response) {
  const { id } = req.params;
  const { status } = req.body;

  const valid = ["QUEUED", "DRILLING", "SUCCESS", "FAILED", "CLOSED"];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `สถานะไม่ถูกต้อง ต้องเป็น ${valid.join(", ")}` });
  }

  await pool.query("UPDATE drilling_jobs SET status = $1 WHERE job_id = $2", [status, id]);
  const row = await getJobRow(id);
  if (!row) return res.status(404).json({ error: "ไม่พบงานเจาะ" });
  broadcast({ type: "JOB_STATUS_CHANGED", data: { job_id: Number(id), status } });
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
    static_water_level_m,
    pumping_water_level_m,
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

  const jobs = await pool.query(
    `SELECT * FROM drilling_jobs
     WHERE job_id = $1 AND (magic_link_expires_at IS NULL OR magic_link_expires_at > NOW())`,
    [id]
  );
  if (!jobs.rows.length) return res.status(404).json({ error: "ไม่พบงานหรือลิงก์หมดอายุ" });
  const job = jobs.rows[0];

  if (magic_token && job.magic_link_token !== magic_token) {
    return res.status(403).json({ error: "Token ไม่ถูกต้อง" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let wellId = job.well_id;
    if (!wellId) {
      const wellResult = (result === "FAIL" || result === "FAILED") ? "FAIL" : "SUCCESS";
      const w = await client.query(
        `INSERT INTO wells
          (customer_id, well_name, total_depth_m, requested_depth_m, drilling_method, formation_water_type,
           water_quantity_m3hr, static_water_level_m, pumping_water_level_m, driller_name, completion_date,
           result, failure_reason, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING well_id`,
        [
          job.customer_id,
          well_name || `บ่อลูกค้า #${job.customer_id}`,
          total_depth_m ?? null,
          requested_depth_m ?? null,
          drilling_method || null,
          formation_water_type || "UNKNOWN",
          water_quantity_m3hr ?? null,
          static_water_level_m ?? null,
          pumping_water_level_m ?? null,
          driller_name || null,
          completion_date || new Date().toISOString().slice(0, 10),
          wellResult,
          failure_reason || null,
          notes || null,
        ]
      );
      wellId = w.rows[0].well_id;

      await client.query(
        "UPDATE drilling_jobs SET well_id = $1, status = 'SUCCESS', result = $2 WHERE job_id = $3",
        [wellId, wellResult, id]
      );
    } else {
      const wellResult = (result === "FAIL" || result === "FAILED") ? "FAIL" : "SUCCESS";
      await client.query(
        `UPDATE wells SET
           well_name = $1, total_depth_m = $2, requested_depth_m = $3, drilling_method = $4, formation_water_type = $5,
           water_quantity_m3hr = $6, static_water_level_m = $7, pumping_water_level_m = $8, driller_name = $9,
           completion_date = $10, result = $11, failure_reason = $12, notes = $13
         WHERE well_id = $14`,
        [
          well_name || null, total_depth_m ?? null, requested_depth_m ?? null, drilling_method || null,
          formation_water_type || "UNKNOWN", water_quantity_m3hr ?? null, static_water_level_m ?? null,
          pumping_water_level_m ?? null, driller_name || null,
          completion_date || new Date().toISOString().slice(0, 10),
          wellResult, failure_reason || null, notes || null, wellId,
        ]
      );
      await client.query(
        "UPDATE drilling_jobs SET status = 'SUCCESS', result = $1 WHERE job_id = $2",
        [wellResult, id]
      );
    }

    if (wellId) {
      if (Array.isArray(strata)) {
        await client.query("DELETE FROM well_strata_logs WHERE well_id = $1", [wellId]);
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
        await client.query("DELETE FROM well_pipes WHERE well_id = $1", [wellId]);
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
        await client.query("DELETE FROM well_pumps WHERE well_id = $1", [wellId]);
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
        await client.query("DELETE FROM well_control_boxes WHERE well_id = $1", [wellId]);
        for (const c of control_boxes) {
          await client.query(
            `INSERT INTO well_control_boxes (well_id, brand, model, capacity, voltage, protection_type, features, installed_date, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [wellId, c.brand || null, c.model || null, c.capacity || null, c.voltage || null, c.protection_type || null, c.features || null, c.installed_date || null, c.notes || null]
          );
        }
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

  const wellResult = (result === "FAIL" || result === "FAILED") ? "FAILED" : "SUCCESS";
  const msg = wellResult === "SUCCESS"
    ? `แจ้งผลการเจาะ: เจาะสำเร็จแล้ว บ่อ ${row?.well_name || ""}\nข้อมูลอยู่ในระบบแล้วครับ`
    : "แจ้งผลการเจาะ: การเจาะไม่สำเร็จ กรุณาติดต่อช่างเพื่อหารือแนวทางต่อไปครับ";
  sendTextToCustomer(job.customer_id, msg, "STATUS").catch(() => {});
  broadcast({ type: "JOB_STATUS_CHANGED", data: { job_id: Number(id), status: "SUCCESS" } });

  res.json(row);
}

export async function remove(req: Request, res: Response) {
  await pool.query("DELETE FROM drilling_jobs WHERE job_id = $1", [req.params.id]);
  res.status(204).end();
}

export async function generateMagicLink(req: Request, res: Response) {
  const { id } = req.params;
  const token = generateMagicToken();
  await pool.query(
    "UPDATE drilling_jobs SET magic_link_token = $1, magic_link_expires_at = NOW() + INTERVAL '7 days' WHERE job_id = $2",
    [token, id]
  );
  res.json({ token });
}
