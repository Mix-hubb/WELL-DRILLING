import { Request, Response } from "express";
import { pool } from "../config/db";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { Driller } from "../types";

export async function list(req: Request, res: Response) {
  const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM drillers ORDER BY created_at DESC");
  res.json(rows as Driller[]);
}

export async function create(req: Request, res: Response) {
  const { team_name, leader_name, phone } = req.body;
  if (!team_name || !leader_name || !phone) {
    return res.status(400).json({ error: "ต้องระบุ team_name, leader_name, phone" });
  }
  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO drillers (team_name, leader_name, phone) VALUES (?, ?, ?)",
    [team_name, leader_name, phone]
  );
  const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM drillers WHERE driller_id = ?", [result.insertId]);
  res.status(201).json(rows[0]);
}

export async function update(req: Request, res: Response) {
  const { id } = req.params;
  const { team_name, leader_name, phone } = req.body;
  await pool.query(
    "UPDATE drillers SET team_name = ?, leader_name = ?, phone = ? WHERE driller_id = ?",
    [team_name, leader_name, phone, id]
  );
  const [rows] = await pool.query<RowDataPacket[]>("SELECT * FROM drillers WHERE driller_id = ?", [id]);
  if (!rows.length) return res.status(404).json({ error: "ไม่พบทีมช่างเจาะ" });
  res.json(rows[0]);
}

export async function remove(req: Request, res: Response) {
  await pool.query("DELETE FROM drillers WHERE driller_id = ?", [req.params.id]);
  res.status(204).end();
}
