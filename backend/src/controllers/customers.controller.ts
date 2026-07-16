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
