import { Request, Response } from "express";
import { pool } from "../config/db";
import { PumpCatalogModel } from "../types";
import { broadcast } from "../services/sse";

export async function list(req: Request, res: Response) {
  const { brand, includeInactive } = req.query;
  const params: any[] = [];
  let where = includeInactive === "true" ? "1=1" : "is_active = true";
  if (brand) {
    params.push(brand);
    where += ` AND brand = $${params.length}`;
  }
  const { rows } = await pool.query(
    `SELECT * FROM pump_catalog_models WHERE ${where} ORDER BY brand, sort_order, model`,
    params
  );
  const models: PumpCatalogModel[] = rows.map((r: any) => ({
    model_id: r.model_id,
    brand: r.brand,
    series: r.series,
    model: r.model,
    bore_size: r.bore_size,
    flow_rate: r.flow_rate,
    motor_power: r.motor_power,
    phase: r.phase,
    discharge_size: r.discharge_size,
    impeller_stages: r.impeller_stages,
    max_head_m: r.max_head_m,
    material: r.material,
    features: r.features,
    reference_price: r.reference_price == null ? null : Number(r.reference_price),
    notes: r.notes,
    sort_order: r.sort_order,
    is_active: r.is_active,
  }));
  res.json(models);
}

export async function create(req: Request, res: Response) {
  const {
    brand,
    series,
    model,
    bore_size,
    flow_rate,
    motor_power,
    phase,
    discharge_size,
    impeller_stages,
    max_head_m,
    material,
    features,
    reference_price,
    notes,
    sort_order,
    is_active,
  } = req.body;

  if (!brand || !model) {
    return res.status(400).json({ error: "ต้องระบุยี่ห้อ (brand) และรุ่น (model)" });
  }

  const { rows } = await pool.query(
    `INSERT INTO pump_catalog_models (
      brand, series, model, bore_size, flow_rate, motor_power, phase,
      discharge_size, impeller_stages, max_head_m, material, features,
      reference_price, notes, sort_order, is_active
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
    ) RETURNING *`,
    [
      brand,
      series || null,
      model,
      bore_size || null,
      flow_rate || null,
      motor_power || null,
      phase || null,
      discharge_size || null,
      impeller_stages || null,
      max_head_m || null,
      material || null,
      features || null,
      reference_price == null || reference_price === "" ? null : Number(reference_price),
      notes || null,
      sort_order == null ? 0 : Number(sort_order),
      is_active !== false,
    ]
  );

  broadcast({
    type: "PUMP_CATALOG_CREATED",
    data: { model_id: rows[0].model_id, brand: rows[0].brand, model: rows[0].model },
  });

  res.status(201).json(rows[0]);
}

export async function update(req: Request, res: Response) {
  const { id } = req.params;
  const {
    brand,
    series,
    model,
    bore_size,
    flow_rate,
    motor_power,
    phase,
    discharge_size,
    impeller_stages,
    max_head_m,
    material,
    features,
    reference_price,
    notes,
    sort_order,
    is_active,
  } = req.body;

  if (!brand || !model) {
    return res.status(400).json({ error: "ต้องระบุยี่ห้อ (brand) และรุ่น (model)" });
  }

  const { rows } = await pool.query(
    `UPDATE pump_catalog_models SET
      brand = $1,
      series = $2,
      model = $3,
      bore_size = $4,
      flow_rate = $5,
      motor_power = $6,
      phase = $7,
      discharge_size = $8,
      impeller_stages = $9,
      max_head_m = $10,
      material = $11,
      features = $12,
      reference_price = $13,
      notes = $14,
      sort_order = $15,
      is_active = $16,
      updated_at = NOW()
    WHERE model_id = $17
    RETURNING *`,
    [
      brand,
      series || null,
      model,
      bore_size || null,
      flow_rate || null,
      motor_power || null,
      phase || null,
      discharge_size || null,
      impeller_stages || null,
      max_head_m || null,
      material || null,
      features || null,
      reference_price == null || reference_price === "" ? null : Number(reference_price),
      notes || null,
      sort_order == null ? 0 : Number(sort_order),
      is_active !== false,
      id,
    ]
  );

  if (!rows.length) {
    return res.status(404).json({ error: "ไม่พบรุ่นปั๊มน้ำ" });
  }

  broadcast({
    type: "PUMP_CATALOG_UPDATED",
    data: { model_id: rows[0].model_id, brand: rows[0].brand, model: rows[0].model },
  });

  res.json(rows[0]);
}

export async function remove(req: Request, res: Response) {
  const { id } = req.params;
  const { rowCount } = await pool.query(
    "DELETE FROM pump_catalog_models WHERE model_id = $1",
    [id]
  );
  if (!rowCount) {
    return res.status(404).json({ error: "ไม่พบรุ่นปั๊มน้ำ" });
  }
  broadcast({ type: "PUMP_CATALOG_DELETED", data: { model_id: Number(id) } });
  res.status(204).end();
}

