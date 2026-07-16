import { Request, Response } from "express";
import { pool } from "../config/db";
import { RowDataPacket, ResultSetHeader } from "mysql2";

export async function list(req: Request, res: Response) {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM customers ORDER BY created_at DESC");
  res.json(rows);
}

export async function create(req: Request, res: Response) {
  const { customer_name, phone, address } = req.body;
  if (!customer_name || !phone) {
    return res.status(400).json({ error: "ต้องระบุ customer_name, phone" });
  }
  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO customers (customer_name, phone, address) VALUES (?, ?, ?)",
    [customer_name, phone, address || null]
  );
  const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM customers WHERE customer_id = ?", [result.insertId]);
  res.status(201).json(rows[0]);
}

export async function update(req: Request, res: Response) {
  const { id } = req.params;
  const { customer_name, phone, address } = req.body;
  await pool.query(
    "UPDATE customers SET customer_name = ?, phone = ?, address = ? WHERE customer_id = ?",
    [customer_name, phone, address, id]
  );
  const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM customers WHERE customer_id = ?", [id]);
  if (!rows.length) return res.status(404).json({ error: "ไม่พบลูกค้า" });
  res.json(rows[0]);
}

export async function remove(req: Request, res: Response) {
  await pool.query("DELETE FROM customers WHERE customer_id = ?", [req.params.id]);
  res.status(204).end();
}
