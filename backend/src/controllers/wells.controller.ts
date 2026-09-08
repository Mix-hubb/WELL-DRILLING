import { Request, Response } from "express";
import { pool } from "../config/db";
import { userFilter } from "../utils/userFilter";
import { FullWell } from "../types";
import { streamWellReportPdf } from "../utils/pdfReport";
import { broadcast } from "../services/sse";

async function getWellRow(id: string, orgId?: string | null): Promise<any | null> {
  const orgClause = orgId ? ` AND c.org_id = $2` : "";
  const params = orgId ? [id, orgId] : [id];
  const { rows } = await pool.query(`
    SELECT
      w.*,
      c.customer_name,
      c.phone AS customer_phone,
      c.line_picture_url,
      CASE
        WHEN w.warranty_expire_date IS NULL THEN 'UNKNOWN'
        WHEN w.warranty_expire_date >= CURRENT_DATE THEN 'ACTIVE'
        ELSE 'EXPIRED'
      END AS warranty_status,
      (w.warranty_expire_date - CURRENT_DATE) AS days_left
    FROM wells w
    JOIN customers c ON c.customer_id = w.customer_id
    WHERE w.well_id = $1${orgClause}
  `, params);
  return rows[0] || null;
}

export async function list(req: Request, res: Response) {
  const { sql, params } = userFilter(req, "c");

  const { rows } = await pool.query(`
    SELECT
      w.*,
      c.customer_name,
      c.phone AS customer_phone,
      c.line_picture_url,
      CASE
        WHEN w.warranty_expire_date IS NULL THEN 'UNKNOWN'
        WHEN w.warranty_expire_date >= CURRENT_DATE THEN 'ACTIVE'
        ELSE 'EXPIRED'
      END AS warranty_status,
      (w.warranty_expire_date - CURRENT_DATE) AS days_left
    FROM wells w
    JOIN customers c ON c.customer_id = w.customer_id
    WHERE 1=1 ${sql}
    ORDER BY w.created_at DESC
  `, params);

  res.json(rows as FullWell[]);
}

export async function getOne(req: Request, res: Response) {
  const { id } = req.params;
  const well = await getWellRow(id, req.user?.orgId);
  if (!well) return res.status(404).json({ error: "ไม่พบบ่อบาดาล" });

  const strata = await pool.query(
    "SELECT * FROM well_strata_logs WHERE well_id = $1 ORDER BY depth_from_m ASC", [id]
  );
  const pipes = await pool.query(
    "SELECT * FROM well_pipes WHERE well_id = $1 ORDER BY depth_from_m ASC", [id]
  );
  const pumps = await pool.query(
    "SELECT * FROM well_pumps WHERE well_id = $1 ORDER BY pump_id ASC", [id]
  );
  const controlBoxes = await pool.query(
    "SELECT * FROM well_control_boxes WHERE well_id = $1 ORDER BY control_box_id ASC", [id]
  );

  res.json({
    ...well,
    strata: strata.rows,
    pipes: pipes.rows,
    pumps: pumps.rows,
    control_boxes: controlBoxes.rows,
  } as FullWell);
}

export async function getByJob(req: Request, res: Response) {
  const { jobId } = req.params;
  const orgId = req.user?.orgId;
  const orgClause = orgId ? ` AND c.org_id = $2` : "";
  const params = orgId ? [jobId, orgId] : [jobId];
  const { rows } = await pool.query(
    `SELECT j.well_id FROM drilling_jobs j JOIN customers c ON c.customer_id = j.customer_id WHERE j.job_id = $1${orgClause}`,
    params
  );
  if (!rows.length || !rows[0].well_id) {
    return res.status(404).json({ error: "ไม่พบประวัติบ่อของงานนี้" });
  }
  const well = await getWellRow(rows[0].well_id, orgId);
  if (!well) return res.status(404).json({ error: "ไม่พบบ่อบาดาล" });

  const strata = await pool.query(
    "SELECT * FROM well_strata_logs WHERE well_id = $1 ORDER BY depth_from_m ASC", [well.well_id]
  );
  const pipes = await pool.query(
    "SELECT * FROM well_pipes WHERE well_id = $1 ORDER BY depth_from_m ASC", [well.well_id]
  );
  const pumps = await pool.query(
    "SELECT * FROM well_pumps WHERE well_id = $1 ORDER BY pump_id ASC", [well.well_id]
  );
  const controlBoxes = await pool.query(
    "SELECT * FROM well_control_boxes WHERE well_id = $1 ORDER BY control_box_id ASC", [well.well_id]
  );

  res.json({ ...well, strata: strata.rows, pipes: pipes.rows, pumps: pumps.rows, control_boxes: controlBoxes.rows } as FullWell);
}

export async function create(req: Request, res: Response) {
  const {
    customer_id,
    job_id,
    well_name,
    address,
    requested_depth_m,
    total_depth_m,
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

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const w = await client.query(
      `INSERT INTO wells
        (customer_id, well_name, address, requested_depth_m, total_depth_m, drilling_method, formation_water_type,
         water_quantity_m3hr, static_water_level_m, pumping_water_level_m, driller_name, completion_date,
         result, failure_reason, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING well_id`,
      [
        customer_id,
        well_name || "บ่อหลัก",
        address || null,
        requested_depth_m ?? null,
        total_depth_m ?? null,
        drilling_method || null,
        formation_water_type || "UNKNOWN",
        water_quantity_m3hr ?? null,
        static_water_level_m ?? null,
        pumping_water_level_m ?? null,
        driller_name || null,
        completion_date || new Date().toISOString().slice(0, 10),
        result === "FAIL" || result === "FAILED" ? "FAIL" : "SUCCESS",
        failure_reason || null,
        notes || null,
      ]
    );

    const newWellId = w.rows[0].well_id;

    if (job_id) {
      await client.query(
        "UPDATE drilling_jobs SET well_id = $1, status = 'SUCCESS', result = 'SUCCESS' WHERE job_id = $2",
        [newWellId, job_id]
      );
    }

    await client.query("COMMIT");
    const well = await getWellRow(newWellId, req.user?.orgId);
    broadcast({ type: "WELL_CREATED", data: { well_id: newWellId, customer_id }, orgId: req.user?.orgId });
    res.status(201).json(well);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function remove(req: Request, res: Response) {
  const { sql, params } = userFilter(req, "c", 1);
  const existing = await pool.query(
    `SELECT w.well_id FROM wells w JOIN customers c ON c.customer_id = w.customer_id WHERE w.well_id = $1${sql}`,
    [req.params.id, ...params]
  );
  if (!existing.rows.length) return res.status(404).json({ error: "ไม่พบบ่อ" });
  await pool.query("DELETE FROM wells WHERE well_id = $1", [req.params.id]);
  broadcast({ type: "WELL_UPDATED", data: { well_id: Number(req.params.id) }, orgId: req.user?.orgId });
  res.status(204).end();
}

export async function addStrata(req: Request, res: Response) {
  const { wellId } = req.params;
  const { depth_from_m, depth_to_m, lithology_type, lithology_name, color_hex, hardness, water_bearing, description } = req.body;
  if (depth_from_m == null || depth_to_m == null) {
    return res.status(400).json({ error: "ต้องระบุ depth_from_m และ depth_to_m" });
  }
  const { sql, params } = userFilter(req, "c", 1);
  const ownershipCheck = await pool.query(
    `SELECT w.well_id FROM wells w JOIN customers c ON c.customer_id = w.customer_id WHERE w.well_id = $1${sql}`,
    [wellId, ...params]
  );
  if (!ownershipCheck.rows.length) return res.status(404).json({ error: "ไม่พบบ่อหรือไม่มีสิทธิ์" });

  const { rows } = await pool.query(
    `INSERT INTO well_strata_logs (well_id, depth_from_m, depth_to_m, lithology_type, lithology_name, color_hex, hardness, water_bearing, description)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [wellId, depth_from_m, depth_to_m, lithology_type || null, lithology_name || null, color_hex || null, hardness || null, water_bearing ? true : false, description || null]
  );
  broadcast({ type: "WELL_UPDATED", data: { well_id: Number(wellId) }, orgId: req.user?.orgId });
  res.status(201).json(rows[0]);
}

export async function removeStrata(req: Request, res: Response) {
  await pool.query("DELETE FROM well_strata_logs WHERE strata_id = $1", [req.params.strataId]);
  broadcast({ type: "WELL_UPDATED", data: { well_id: Number(req.params.wellId) }, orgId: req.user?.orgId });
  res.status(204).end();
}

export async function addPipe(req: Request, res: Response) {
  const { wellId } = req.params;
  const { material, pipe_type, size_mm, depth_from_m, depth_to_m, quantity, notes } = req.body;
  if (depth_from_m == null || depth_to_m == null) {
    return res.status(400).json({ error: "ต้องระบุ depth_from_m และ depth_to_m" });
  }
  const { sql, params } = userFilter(req, "c", 1);
  const ownershipCheck = await pool.query(
    `SELECT w.well_id FROM wells w JOIN customers c ON c.customer_id = w.customer_id WHERE w.well_id = $1${sql}`,
    [wellId, ...params]
  );
  if (!ownershipCheck.rows.length) return res.status(404).json({ error: "ไม่พบบ่อหรือไม่มีสิทธิ์" });

  const { rows } = await pool.query(
    `INSERT INTO well_pipes (well_id, material, pipe_type, size_mm, depth_from_m, depth_to_m, quantity, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [wellId, material || null, pipe_type || null, size_mm ?? null, depth_from_m, depth_to_m, quantity || 1, notes || null]
  );
  broadcast({ type: "WELL_UPDATED", data: { well_id: Number(wellId) }, orgId: req.user?.orgId });
  res.status(201).json(rows[0]);
}

export async function removePipe(req: Request, res: Response) {
  await pool.query("DELETE FROM well_pipes WHERE pipe_id = $1", [req.params.pipeId]);
  broadcast({ type: "WELL_UPDATED", data: { well_id: Number(req.params.wellId) }, orgId: req.user?.orgId });
  res.status(204).end();
}

export async function addPump(req: Request, res: Response) {
  const { wellId } = req.params;
  const {
    pump_type, brand, pump_model, horsepower, power_kw, impeller_stages, installation_depth_m,
    voltage, phase, discharge_size_mm, rated_flow_m3hr, rated_head_m, installed_date, notes,
  } = req.body;
  const { sql, params } = userFilter(req, "c", 1);
  const ownershipCheck = await pool.query(
    `SELECT w.well_id FROM wells w JOIN customers c ON c.customer_id = w.customer_id WHERE w.well_id = $1${sql}`,
    [wellId, ...params]
  );
  if (!ownershipCheck.rows.length) return res.status(404).json({ error: "ไม่พบบ่อหรือไม่มีสิทธิ์" });

  const { rows } = await pool.query(
    `INSERT INTO well_pumps
      (well_id, pump_type, brand, pump_model, horsepower, power_kw, impeller_stages, installation_depth_m,
       voltage, phase, discharge_size_mm, rated_flow_m3hr, rated_head_m, installed_date, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
    [
      wellId, pump_type || null, brand || null, pump_model || null, horsepower ?? null, power_kw ?? null,
      impeller_stages ?? null, installation_depth_m ?? null, voltage || null, phase ?? null,
      discharge_size_mm ?? null, rated_flow_m3hr ?? null, rated_head_m ?? null,
      installed_date || null, notes || null,
    ]
  );
  broadcast({ type: "WELL_UPDATED", data: { well_id: Number(wellId) }, orgId: req.user?.orgId });
  res.status(201).json(rows[0]);
}

export async function removePump(req: Request, res: Response) {
  await pool.query("DELETE FROM well_pumps WHERE pump_id = $1", [req.params.pumpId]);
  broadcast({ type: "WELL_UPDATED", data: { well_id: Number(req.params.wellId) }, orgId: req.user?.orgId });
  res.status(204).end();
}

export async function addControlBox(req: Request, res: Response) {
  const { wellId } = req.params;
  const { brand, model, capacity, voltage, protection_type, features, installed_date, notes } = req.body;
  const { sql, params } = userFilter(req, "c", 1);
  const ownershipCheck = await pool.query(
    `SELECT w.well_id FROM wells w JOIN customers c ON c.customer_id = w.customer_id WHERE w.well_id = $1${sql}`,
    [wellId, ...params]
  );
  if (!ownershipCheck.rows.length) return res.status(404).json({ error: "ไม่พบบ่อหรือไม่มีสิทธิ์" });

  const { rows } = await pool.query(
    `INSERT INTO well_control_boxes (well_id, brand, model, capacity, voltage, protection_type, features, installed_date, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [wellId, brand || null, model || null, capacity || null, voltage || null, protection_type || null, features || null, installed_date || null, notes || null]
  );
  broadcast({ type: "WELL_UPDATED", data: { well_id: Number(wellId) }, orgId: req.user?.orgId });
  res.status(201).json(rows[0]);
}

export async function removeControlBox(req: Request, res: Response) {
  await pool.query("DELETE FROM well_control_boxes WHERE control_box_id = $1", [req.params.controlBoxId]);
  broadcast({ type: "WELL_UPDATED", data: { well_id: Number(req.params.wellId) }, orgId: req.user?.orgId });
  res.status(204).end();
}

export async function exportReport(req: Request, res: Response) {
  const { id } = req.params;
  const well = await getWellRow(id, req.user?.orgId);
  if (!well) return res.status(404).json({ error: "ไม่พบบ่อบาดาล" });

  const strata = await pool.query(
    "SELECT * FROM well_strata_logs WHERE well_id = $1 ORDER BY depth_from_m ASC", [id]
  );
  const pipes = await pool.query(
    "SELECT * FROM well_pipes WHERE well_id = $1 ORDER BY depth_from_m ASC", [id]
  );
  const pumps = await pool.query(
    "SELECT * FROM well_pumps WHERE well_id = $1 ORDER BY pump_id ASC", [id]
  );
  const controlBoxes = await pool.query(
    "SELECT * FROM well_control_boxes WHERE well_id = $1 ORDER BY control_box_id ASC", [id]
  );

  const fullWell = { ...well, strata: strata.rows, pipes: pipes.rows, pumps: pumps.rows, control_boxes: controlBoxes.rows } as FullWell;
  const job = {
    job_title: fullWell.well_name,
    site_address: fullWell.address || "",
    customer_name: fullWell.customer_name || "",
    driller_name: fullWell.driller_name || "-",
    scheduled_date: fullWell.completion_date || "-",
  };

  streamWellReportPdf(res, fullWell, job);
}
