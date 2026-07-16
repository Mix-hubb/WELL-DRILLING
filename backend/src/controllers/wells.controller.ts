import { Request, Response } from "express";
import { pool } from "../config/db";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { streamWellReportPdf } from "../utils/pdfReport";
import { userFilter } from "../utils/userFilter";

// ============================================================
// Helper: ดึงข้อมูลบ่อเต็มพร้อม strata + pipes + pumps + maintenance
// ============================================================
async function getFullWell(wellId: number | string, userId?: number) {
  const userCond = userId ? ` AND c.user_id = ${userId}` : "";
  const [wells] = await pool.query<RowDataPacket[]>(
    `SELECT w.*,
            j.job_reference, j.job_title, j.site_address, j.province, j.district,
            j.latitude, j.longitude,
            c.customer_name, c.phone AS customer_phone,
            CASE
              WHEN w.warranty_expire_date >= CURDATE() THEN 'IN_WARRANTY'
              ELSE 'EXPIRED'
            END AS warranty_status,
            DATEDIFF(w.warranty_expire_date, CURDATE()) AS warranty_remaining_days
     FROM well_logs w
     JOIN drilling_jobs j ON j.job_id = w.job_id
     JOIN customers c     ON c.customer_id = j.customer_id
     WHERE w.well_id = ?${userCond}`,
    [wellId]
  );
  const well = wells[0];
  if (!well) return null;

  const [strata] = await pool.query<RowDataPacket[]>(`
    SELECT s.*,
           lt.type_name_th AS lithology_name,
           lt.type_name    AS lithology_name_en,
           COALESCE(s.color_override, lt.color_hex) AS fill_color,
           lt.pattern      AS svg_pattern
    FROM well_strata_logs s
    JOIN lithology_types lt ON lt.type_id = s.lithology_type_id
    WHERE s.well_id = ?
    ORDER BY s.depth_from ASC
  `, [wellId]);

  const [pipes] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM well_pipes WHERE well_id = ? ORDER BY depth_from ASC", [wellId]
  );
  const [pumps] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM well_pumps WHERE well_id = ?", [wellId]
  );
  const [maintenance] = await pool.query<RowDataPacket[]>(`
    SELECT m.*, et.type_name_th AS event_type_name
    FROM maintenance_logs m
    JOIN maintenance_event_types et ON et.event_type_id = m.event_type_id
    WHERE m.well_id = ?
    ORDER BY m.event_date DESC
  `, [wellId]);

  return {
    ...(well as any),
    strata:      strata as any[],
    pipes:       pipes as any[],
    pumps:       pumps as any[],
    maintenance: maintenance as any[],
  };
}

function getEffectiveUserId(req: Request): number | undefined {
  return req.user!.role === "ADMIN" ? undefined : req.user!.userId;
}

// ============================================================
// GET /api/wells
// ============================================================
export async function list(req: Request, res: Response) {
  const { sql, params } = userFilter(req);
  const [wells] = await pool.query<RowDataPacket[]>(`
    SELECT w.well_id, w.total_depth, w.water_quantity, w.completion_date,
           w.warranty_expire_date,
           CASE
             WHEN w.warranty_expire_date >= CURDATE() THEN 'IN_WARRANTY'
             ELSE 'EXPIRED'
           END AS warranty_status,
           DATEDIFF(w.warranty_expire_date, CURDATE()) AS warranty_remaining_days,
           j.job_id, j.job_reference, j.job_title, j.site_address, j.province,
           c.customer_name
    FROM well_logs w
    JOIN drilling_jobs j ON j.job_id = w.job_id
    JOIN customers c     ON c.customer_id = j.customer_id
    WHERE 1=1 ${sql}
    ORDER BY w.completion_date DESC
  `, params);
  res.json(wells);
}

// ============================================================
// GET /api/wells/:id
// ============================================================
export async function getOne(req: Request, res: Response) {
  const well = await getFullWell(req.params.id, getEffectiveUserId(req));
  if (!well) return res.status(404).json({ error: "ไม่พบบ่อบาดาล" });
  res.json(well);
}

// ============================================================
// GET /api/wells/by-job/:jobId
// ============================================================
export async function getByJob(req: Request, res: Response) {
  const userId = getEffectiveUserId(req);
  const userCond = userId ? ` AND c.user_id = ${userId}` : "";
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT w.well_id FROM well_logs w
     JOIN drilling_jobs j ON j.job_id = w.job_id
     JOIN customers c ON c.customer_id = j.customer_id
     WHERE w.job_id = ?${userCond}`,
    [req.params.jobId]
  );
  if (!rows.length) return res.status(404).json({ error: "งานนี้ยังไม่มีประวัติบ่อบาดาล" });
  const well = await getFullWell(rows[0].well_id, userId);
  res.json(well);
}

// ============================================================
// POST /api/wells
// ============================================================
export async function create(req: Request, res: Response) {
  const {
    job_id, total_depth, casing_depth, water_quantity, yield_lpm,
    static_water_level, pumping_water_level, pump_depth, pump_power_kw,
    pump_brand, pump_type, drilling_method, formation_water_type,
    driller_name, completion_date, gps_accuracy_m, notes,
  } = req.body;

  const userId = getEffectiveUserId(req);
  const userCond = userId ? ` AND c.user_id = ${userId}` : "";
  const [jobs] = await pool.query<RowDataPacket[]>(
    `SELECT j.* FROM drilling_jobs j
     JOIN customers c ON c.customer_id = j.customer_id
     WHERE j.job_id = ?${userCond}`,
    [job_id]
  );
  if (!jobs.length) return res.status(404).json({ error: "ไม่พบคิวงาน" });
  if (jobs[0].status !== "COMPLETED") {
    return res.status(400).json({ error: "สร้างบันทึกบ่อได้เฉพาะคิวงานสถานะ COMPLETED เท่านั้น" });
  }
  if (!completion_date) {
    return res.status(400).json({ error: "กรุณาระบุ completion_date" });
  }

  try {
    const [result] = await pool.query<ResultSetHeader>(`
      INSERT INTO well_logs
        (job_id, total_depth, casing_depth, water_quantity, yield_lpm,
         static_water_level, pumping_water_level, pump_depth, pump_power_kw,
         pump_brand, pump_type, drilling_method, formation_water_type,
         driller_name, completion_date, gps_accuracy_m, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      job_id, total_depth, casing_depth || null, water_quantity || 0, yield_lpm || null,
      static_water_level || 0, pumping_water_level || 0, pump_depth || null, pump_power_kw || null,
      pump_brand || null, pump_type || null, drilling_method || null, formation_water_type || "UNKNOWN",
      driller_name || null, completion_date, gps_accuracy_m || null, notes || null,
    ]);

    await pool.query("UPDATE drilling_jobs SET status = 'COMPLETED' WHERE job_id = ?", [job_id]);

    const well = await getFullWell(result.insertId, userId);
    res.status(201).json(well);
  } catch (err: any) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "คิวงานนี้มีบันทึกบ่ออยู่แล้ว (1 งาน : 1 บ่อ)" });
    }
    throw err;
  }
}

/* ---------- Strata ---------- */
export async function addStrata(req: Request, res: Response) {
  const {
    lithology_type_id, depth_from, depth_to, color_override,
    hardness, rqd_percent, is_water_bearing,
    conductivity_us, ph_value, tds_ppm, description,
  } = req.body;

  if (!lithology_type_id || depth_from == null || depth_to == null) {
    return res.status(400).json({ error: "ต้องระบุ lithology_type_id, depth_from, depth_to" });
  }

  const well = await getFullWell(req.params.wellId, getEffectiveUserId(req));
  if (!well) return res.status(404).json({ error: "ไม่พบบ่อบาดาล" });

  await pool.query(`
    INSERT INTO well_strata_logs
      (well_id, lithology_type_id, depth_from, depth_to, color_override,
       hardness, rqd_percent, is_water_bearing, conductivity_us, ph_value, tds_ppm, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    req.params.wellId, lithology_type_id, depth_from, depth_to, color_override || null,
    hardness || null, rqd_percent || null, is_water_bearing ? 1 : 0,
    conductivity_us || null, ph_value || null, tds_ppm || null, description || null,
  ]);
  res.status(201).json(await getFullWell(req.params.wellId, getEffectiveUserId(req)));
}

export async function removeStrata(req: Request, res: Response) {
  const well = await getFullWell(req.params.wellId, getEffectiveUserId(req));
  if (!well) return res.status(404).json({ error: "ไม่พบบ่อบาดาล" });

  await pool.query(
    "DELETE FROM well_strata_logs WHERE strata_id = ? AND well_id = ?",
    [req.params.strataId, req.params.wellId]
  );
  res.json(await getFullWell(req.params.wellId, getEffectiveUserId(req)));
}

/* ---------- Pipes ---------- */
export async function addPipe(req: Request, res: Response) {
  const { depth_from, depth_to, pipe_type, pipe_size, thickness_class, quantity, notes } = req.body;

  const well = await getFullWell(req.params.wellId, getEffectiveUserId(req));
  if (!well) return res.status(404).json({ error: "ไม่พบบ่อบาดาล" });

  await pool.query(`
    INSERT INTO well_pipes (well_id, depth_from, depth_to, pipe_type, pipe_size, thickness_class, quantity, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [req.params.wellId, depth_from, depth_to, pipe_type, pipe_size, thickness_class || "NONE", quantity || 1, notes || null]);
  res.status(201).json(await getFullWell(req.params.wellId, getEffectiveUserId(req)));
}

export async function removePipe(req: Request, res: Response) {
  const well = await getFullWell(req.params.wellId, getEffectiveUserId(req));
  if (!well) return res.status(404).json({ error: "ไม่พบบ่อบาดาล" });

  await pool.query(
    "DELETE FROM well_pipes WHERE pipe_id = ? AND well_id = ?",
    [req.params.pipeId, req.params.wellId]
  );
  res.json(await getFullWell(req.params.wellId, getEffectiveUserId(req)));
}

/* ---------- Pumps ---------- */
export async function addPump(req: Request, res: Response) {
  const { pump_type, brand, horsepower, power_kw, impeller_stages, installation_depth, installed_date, notes } = req.body;

  const well = await getFullWell(req.params.wellId, getEffectiveUserId(req));
  if (!well) return res.status(404).json({ error: "ไม่พบบ่อบาดาล" });

  await pool.query(`
    INSERT INTO well_pumps (well_id, pump_type, brand, horsepower, power_kw, impeller_stages, installation_depth, installed_date, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [req.params.wellId, pump_type, brand || null, horsepower || 0, power_kw || null,
      impeller_stages || null, installation_depth || 0, installed_date, notes || null]);
  res.status(201).json(await getFullWell(req.params.wellId, getEffectiveUserId(req)));
}

export async function removePump(req: Request, res: Response) {
  const well = await getFullWell(req.params.wellId, getEffectiveUserId(req));
  if (!well) return res.status(404).json({ error: "ไม่พบบ่อบาดาล" });

  await pool.query(
    "DELETE FROM well_pumps WHERE pump_id = ? AND well_id = ?",
    [req.params.pumpId, req.params.wellId]
  );
  res.json(await getFullWell(req.params.wellId, getEffectiveUserId(req)));
}

/* ---------- Lithology Types (dropdown) ---------- */
export async function getLithologyTypes(_req: Request, res: Response) {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM lithology_types ORDER BY type_id"
  );
  res.json(rows);
}

/* ---------- PDF report ---------- */
export async function exportReport(req: Request, res: Response) {
  const well = await getFullWell(req.params.id, getEffectiveUserId(req));
  if (!well) return res.status(404).json({ error: "ไม่พบบ่อบาดาล" });

  const [rows] = await pool.query<RowDataPacket[]>(`
    SELECT j.job_title, j.site_address, j.scheduled_date,
           c.customer_name, c.phone,
           w.driller_name
    FROM drilling_jobs j
    JOIN customers c ON c.customer_id = j.customer_id
    JOIN well_logs w ON w.job_id = j.job_id
    WHERE j.job_id = ?
  `, [well.job_id]);

  if (!rows.length) return res.status(404).json({ error: "ไม่พบคิวงานที่เกี่ยวข้อง" });
  streamWellReportPdf(res, well, rows[0] as any);
}
