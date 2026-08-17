import { Request, Response } from "express";
import { pool } from "../config/db";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { userFilter, userWhere } from "../utils/userFilter";

export async function list(req: Request, res: Response) {
  const { sql, params } = userWhere(req, "customers");
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM customers ${sql} ORDER BY created_at DESC`, params
  );
  res.json(rows);
}

export async function getOne(req: Request, res: Response) {
  const { id } = req.params;
  const { sql, params } = userFilter(req, "customers");
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM customers WHERE customer_id = ?${sql}`, [id, ...params]
  );
  if (!rows.length) return res.status(404).json({ error: "ไม่พบลูกค้า" });
  const [[agg]] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS total_wells FROM wells WHERE customer_id = ?", [id]
  );
  res.json({ ...rows[0], total_wells: Number(agg.total_wells) || 0 });
}

export async function getOverview(req: Request, res: Response) {
  const { id } = req.params;
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM customers WHERE customer_id = ?", [id]
  );
  if (!rows.length) return res.status(404).json({ error: "ไม่พบลูกค้า" });

  const customer = rows[0];

  const [wells] = await pool.query<RowDataPacket[]>(
    `SELECT
       w.*,
       CASE
         WHEN w.warranty_expire_date IS NULL THEN 'UNKNOWN'
         WHEN w.warranty_expire_date >= CURDATE() THEN 'ACTIVE'
         ELSE 'EXPIRED'
       END AS warranty_status,
       DATEDIFF(w.warranty_expire_date, CURDATE()) AS days_left
     FROM wells w WHERE w.customer_id = ? ORDER BY w.created_at DESC`, [id]
  );

  const [jobs] = await pool.query<RowDataPacket[]>(
    `SELECT j.* FROM drilling_jobs j WHERE j.customer_id = ? ORDER BY j.created_at DESC`, [id]
  );

  const [requests] = await pool.query<RowDataPacket[]>(
    `SELECT r.* FROM drilling_requests r WHERE r.customer_id = ? ORDER BY r.created_at DESC`, [id]
  );

  const [repairs] = await pool.query<RowDataPacket[]>(
    `SELECT r.* FROM repair_requests r WHERE r.customer_id = ? ORDER BY r.created_at DESC`, [id]
  );

  res.json({
    customer,
    wells,
    jobs,
    drillingRequests: requests,
    repairRequests: repairs,
  });
}

export async function create(req: Request, res: Response) {
  const { customer_name, phone, phone_alt, address } = req.body;
  if (!customer_name || !phone) {
    return res.status(400).json({ error: "ต้องระบุ customer_name, phone" });
  }
  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO customers (user_id, customer_name, phone, phone_alt, address) VALUES (?, ?, ?, ?, ?)",
    [req.user!.userId, customer_name, phone, phone_alt || null, address || null]
  );
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM customers WHERE customer_id = ?", [result.insertId]
  );
  res.status(201).json(rows[0]);
}

export async function update(req: Request, res: Response) {
  const { id } = req.params;
  const { customer_name, phone, phone_alt, address } = req.body;
  const { sql, params } = userFilter(req, "customers");
  await pool.query(
    `UPDATE customers SET customer_name = ?, phone = ?, phone_alt = ?, address = ? WHERE customer_id = ?${sql}`,
    [customer_name, phone, phone_alt || null, address || null, id, ...params]
  );
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT * FROM customers WHERE customer_id = ?", [id]
  );
  if (!rows.length) return res.status(404).json({ error: "ไม่พบลูกค้า" });
  res.json(rows[0]);
}

export async function remove(req: Request, res: Response) {
  const { sql, params } = userFilter(req, "customers");
  await pool.query(
    `DELETE FROM customers WHERE customer_id = ?${sql}`,
    [req.params.id, ...params]
  );
  res.status(204).end();
}
