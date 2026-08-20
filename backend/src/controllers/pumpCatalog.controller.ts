import { Request, Response } from "express";
import { pool } from "../config/db";
import { PumpCatalogModel } from "../types";

export async function list(req: Request, res: Response) {
  const { brand } = req.query;
  const params: any[] = [];
  let where = "is_active = true";
  if (brand) {
    where += " AND brand = $1";
    params.push(brand);
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
