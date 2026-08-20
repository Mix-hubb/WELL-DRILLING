import { Request, Response } from "express";
import { pool } from "../config/db";
import { userFilter, userWhere } from "../utils/userFilter";

export async function list(req: Request, res: Response) {
  const { sql, params } = userWhere(req, "customers");
  const { rows } = await pool.query(
    `SELECT * FROM customers ${sql} ORDER BY created_at DESC`, params
  );
  res.json(rows);
}

export async function getOne(req: Request, res: Response) {
  const { id } = req.params;
  const { sql, params } = userFilter(req, "customers");
  const { rows } = await pool.query(
    `SELECT * FROM customers WHERE customer_id = $1${sql}`, [id, ...params]
  );
  if (!rows.length) return res.status(404).json({ error: "ไม่พบลูกค้า" });
  const agg = await pool.query(
    "SELECT COUNT(*) AS total_wells FROM wells WHERE customer_id = $1", [id]
  );
  res.json({ ...rows[0], total_wells: Number(agg.rows[0].total_wells) || 0 });
}

export async function getOverview(req: Request, res: Response) {
  const { id } = req.params;
  const { rows } = await pool.query(
    "SELECT * FROM customers WHERE customer_id = $1", [id]
  );
  if (!rows.length) return res.status(404).json({ error: "ไม่พบลูกค้า" });

  const customer = rows[0];

  const wells = await pool.query(
    `SELECT
       w.*,
       CASE
         WHEN w.warranty_expire_date IS NULL THEN 'UNKNOWN'
         WHEN w.warranty_expire_date >= CURRENT_DATE THEN 'ACTIVE'
         ELSE 'EXPIRED'
       END AS warranty_status,
       (w.warranty_expire_date - CURRENT_DATE) AS days_left
     FROM wells w WHERE w.customer_id = $1 ORDER BY w.created_at DESC`, [id]
  );

  const jobs = await pool.query(
    `SELECT j.* FROM drilling_jobs j WHERE j.customer_id = $1 ORDER BY j.created_at DESC`, [id]
  );

  const requests = await pool.query(
    `SELECT r.* FROM drilling_requests r WHERE r.customer_id = $1 ORDER BY r.created_at DESC`, [id]
  );

  const repairs = await pool.query(
    `SELECT r.* FROM repair_requests r WHERE r.customer_id = $1 ORDER BY r.created_at DESC`, [id]
  );

  res.json({
    customer,
    wells: wells.rows,
    jobs: jobs.rows,
    drillingRequests: requests.rows,
    repairRequests: repairs.rows,
  });
}

export async function create(req: Request, res: Response) {
  const { customer_name, phone, phone_alt, address } = req.body;
  if (!customer_name || !phone) {
    return res.status(400).json({ error: "ต้องระบุ customer_name, phone" });
  }
  const { rows } = await pool.query(
    `INSERT INTO customers (user_id, customer_name, phone, phone_alt, address) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [req.user!.userId, customer_name, phone, phone_alt || null, address || null]
  );
  res.status(201).json(rows[0]);
}

export async function update(req: Request, res: Response) {
  const { id } = req.params;
  const { customer_name, phone, phone_alt, address } = req.body;
  const { sql, params } = userFilter(req, "customers");
  await pool.query(
    `UPDATE customers SET customer_name = $1, phone = $2, phone_alt = $3, address = $4 WHERE customer_id = $5${sql}`,
    [customer_name, phone, phone_alt || null, address || null, id, ...params]
  );
  const { rows } = await pool.query(
    "SELECT * FROM customers WHERE customer_id = $1", [id]
  );
  if (!rows.length) return res.status(404).json({ error: "ไม่พบลูกค้า" });
  res.json(rows[0]);
}

export async function remove(req: Request, res: Response) {
  const { sql, params } = userFilter(req, "customers");
  await pool.query(
    `DELETE FROM customers WHERE customer_id = $1${sql}`,
    [req.params.id, ...params]
  );
  res.status(204).end();
}
