import { Request, Response } from "express";
import crypto from "crypto";
import { pool } from "../config/db";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { userFilter } from "../utils/userFilter";
import { DrillingJob } from "../types";
import { sendTextToCustomer } from "../services/line";

function generateMagicToken(): string {
  return "drill-" + crypto.randomBytes(16).toString("hex");
}

async function getJobRow(id: number): Promise<RowDataPacket | null> {
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      j.*,
      c.customer_name,
      c.phone AS customer_phone,
      w.well_name,
      w.warranty_expire_date
    FROM drilling_jobs j
    JOIN customers c ON c.customer_id = j.customer_id
    LEFT JOIN wells w ON w.well_id = j.well_id
    WHERE j.job_id = ?
  `, [id]);
  return rows[0] || null;
}

export async function list(req: Request, res: Response) {
  const { status } = req.query;
  const { sql, params } = userFilter(req);

  let where = "1=1";
  const whereParams: any[] = [];
  if (status && status !== "ALL") {
    where += " AND j.status = ?";
    whereParams.push(status);
  }

  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      j.*,
      c.customer_name,
      c.phone AS customer_phone,
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
  const row = await getJobRow(Number(id));
  if (!row) return res.status(404).json({ error: "ไม่พบงานเจาะ" });

  let request = null;
  if (row.request_id) {
    const [reqRows] = await pool.query<RowDataPacket[]>(
      "SELECT * FROM drilling_requests WHERE request_id = ?", [row.request_id]
    );
    if (reqRows.length) {
      request = reqRows[0];
      if (request.quotation_id) {
        const [quoteRows] = await pool.query<RowDataPacket[]>(
          "SELECT * FROM quotations WHERE drilling_request_id = ? ORDER BY created_at DESC LIMIT 1",
          [request.request_id]
        );
        if (quoteRows.length) request.quotation = quoteRows[0];
      }
    }
  }

  res.json({ ...row, request });
}

export async function getByMagicToken(req: Request, res: Response) {
  const { token } = req.params;
  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT
      j.*,
      c.customer_name,
      c.phone AS customer_phone,
      w.well_name,
      w.warranty_expire_date
    FROM drilling_jobs j
    JOIN customers c ON c.customer_id = j.customer_id
    LEFT JOIN wells w ON w.well_id = j.well_id
    WHERE j.magic_link_token = ?
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
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO drilling_jobs
      (request_id, customer_id, job_title, site_address, province, district, scheduled_date, notes, magic_link_token, magic_link_expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))`,
    [request_id || null, customer_id, job_title || null, site_address || null, province || null, district || null, scheduled_date || null, notes || null, token]
  );

  if (request_id) {
    await pool.query("UPDATE drilling_requests SET status = 'ACCEPTED' WHERE request_id = ?", [request_id]);
  }

  const row = await getJobRow(result.insertId);
  res.status(201).json(row);
}

export async function updateStatus(req: Request, res: Response) {
  const { id } = req.params;
  const { status } = req.body;

  const valid = ["QUEUED", "DRILLING", "SUCCESS", "FAILED", "CLOSED"];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `สถานะไม่ถูกต้อง ต้องเป็น ${valid.join(", ")}` });
  }

  await pool.query("UPDATE drilling_jobs SET status = ? WHERE job_id = ?", [status, id]);
  const row = await getJobRow(Number(id));
  if (!row) return res.status(404).json({ error: "ไม่พบงานเจาะ" });
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

  const [jobs] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM drilling_jobs
     WHERE job_id = ? AND (magic_link_expires_at IS NULL OR magic_link_expires_at > NOW())`,
    [id]
  );
  if (!jobs.length) return res.status(404).json({ error: "ไม่พบงานหรือลิงก์หมดอายุ" });
  const job = jobs[0];

  if (magic_token && job.magic_link_token !== magic_token) {
    return res.status(403).json({ error: "Token ไม่ถูกต้อง" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    let wellId = job.well_id;
    if (!wellId) {
      const wellResult = (result === "FAIL" || result === "FAILED") ? "FAIL" : "SUCCESS";
      const [w] = await conn.query<ResultSetHeader>(
        `INSERT INTO wells
          (customer_id, well_name, total_depth_m, requested_depth_m, drilling_method, formation_water_type,
           water_quantity_m3hr, static_water_level_m, pumping_water_level_m, driller_name, completion_date,
           result, failure_reason, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      wellId = w.insertId;

      await conn.query(
        "UPDATE drilling_jobs SET well_id = ?, status = 'SUCCESS', result = ? WHERE job_id = ?",
        [wellId, wellResult, id]
      );
    } else {
      const wellResult = (result === "FAIL" || result === "FAILED") ? "FAIL" : "SUCCESS";
      await conn.query(
        `UPDATE wells SET
           well_name = ?, total_depth_m = ?, requested_depth_m = ?, drilling_method = ?, formation_water_type = ?,
           water_quantity_m3hr = ?, static_water_level_m = ?, pumping_water_level_m = ?, driller_name = ?,
           completion_date = ?, result = ?, failure_reason = ?, notes = ?
         WHERE well_id = ?`,
        [
          well_name || null, total_depth_m ?? null, requested_depth_m ?? null, drilling_method || null,
          formation_water_type || "UNKNOWN", water_quantity_m3hr ?? null, static_water_level_m ?? null,
          pumping_water_level_m ?? null, driller_name || null,
          completion_date || new Date().toISOString().slice(0, 10),
          wellResult, failure_reason || null, notes || null, wellId,
        ]
      );
      await conn.query(
        "UPDATE drilling_jobs SET status = 'SUCCESS', result = ? WHERE job_id = ?",
        [wellResult, id]
      );
    }

    // ---- Replace well detail arrays (strata / pipes / pumps / control boxes) ----
    if (wellId) {
      if (Array.isArray(strata)) {
        await conn.query("DELETE FROM well_strata_logs WHERE well_id = ?", [wellId]);
        for (const s of strata) {
          if (s.depth_from_m == null || s.depth_to_m == null) continue;
          await conn.query(
            `INSERT INTO well_strata_logs
              (well_id, depth_from_m, depth_to_m, lithology_type, lithology_name, color_hex, hardness, water_bearing, description)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              wellId, s.depth_from_m, s.depth_to_m,
              s.lithology_type || null, s.lithology_name || null, s.color_hex || null,
              s.hardness || null, s.water_bearing ? 1 : 0, s.description || null,
            ]
          );
        }
      }

      if (Array.isArray(pipes)) {
        await conn.query("DELETE FROM well_pipes WHERE well_id = ?", [wellId]);
        for (const p of pipes) {
          if (p.depth_from_m == null || p.depth_to_m == null) continue;
          await conn.query(
            `INSERT INTO well_pipes (well_id, material, pipe_type, size_mm, depth_from_m, depth_to_m, quantity, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [wellId, p.material || null, p.pipe_type || null, p.size_mm ?? null, p.depth_from_m, p.depth_to_m, p.quantity || 1, p.notes || null]
          );
        }
      }

      if (Array.isArray(pumps)) {
        await conn.query("DELETE FROM well_pumps WHERE well_id = ?", [wellId]);
        for (const p of pumps) {
          await conn.query(
            `INSERT INTO well_pumps
              (well_id, pump_type, brand, pump_model, horsepower, power_kw, impeller_stages, installation_depth_m,
               voltage, phase, discharge_size_mm, rated_flow_m3hr, rated_head_m, installed_date, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        await conn.query("DELETE FROM well_control_boxes WHERE well_id = ?", [wellId]);
        for (const c of control_boxes) {
          await conn.query(
            `INSERT INTO well_control_boxes (well_id, brand, model, capacity, voltage, protection_type, features, installed_date, notes)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [wellId, c.brand || null, c.model || null, c.capacity || null, c.voltage || null, c.protection_type || null, c.features || null, c.installed_date || null, c.notes || null]
          );
        }
      }
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  const row = await getJobRow(Number(id));

  const wellResult = (result === "FAIL" || result === "FAILED") ? "FAILED" : "SUCCESS";
  const msg = wellResult === "SUCCESS"
    ? `แจ้งผลการเจาะ: เจาะสำเร็จแล้ว บ่อ ${row?.well_name || ""}\nข้อมูลอยู่ในระบบแล้วครับ`
    : "แจ้งผลการเจาะ: การเจาะไม่สำเร็จ กรุณาติดต่อช่างเพื่อหารือแนวทางต่อไปครับ";
  sendTextToCustomer(job.customer_id, msg, "STATUS").catch(() => {});

  res.json(row);
}

export async function remove(req: Request, res: Response) {
  await pool.query("DELETE FROM drilling_jobs WHERE job_id = ?", [req.params.id]);
  res.status(204).end();
}

export async function generateMagicLink(req: Request, res: Response) {
  const { id } = req.params;
  const token = generateMagicToken();
  await pool.query(
    "UPDATE drilling_jobs SET magic_link_token = ?, magic_link_expires_at = DATE_ADD(NOW(), INTERVAL 7 DAY) WHERE job_id = ?",
    [token, id]
  );
  res.json({ token });
}
