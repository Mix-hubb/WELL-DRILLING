import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../config/db";
import { signToken } from "../middleware/auth";
import { UserRole } from "../types";

const USER_ROLE: UserRole = "DRILLER";

export async function register(req: Request, res: Response) {
  const { email, password, full_name } = req.body;
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: "ต้องระบุ email, password, full_name" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" });
  }

  const existing = await pool.query(
    "SELECT user_id FROM users WHERE email = $1", [email]
  );
  if (existing.rows.length) {
    return res.status(409).json({ error: "อีเมลนี้ถูกใช้แล้ว" });
  }

  const password_hash = await bcrypt.hash(password, 10);

  const { rows } = await pool.query(
    "INSERT INTO users (user_id, email, password_hash, full_name, role) VALUES (gen_random_uuid(), $1, $2, $3, $4) RETURNING user_id",
    [email, password_hash, full_name, USER_ROLE]
  );

  const newUserId = rows[0].user_id;
  const token = signToken({ userId: newUserId, email, role: USER_ROLE });
  res.status(201).json({
    token,
    user: { user_id: newUserId, email, full_name, role: USER_ROLE },
  });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "ต้องระบุ email และ password" });
  }

  const { rows } = await pool.query(
    "SELECT user_id, email, password_hash, full_name FROM users WHERE email = $1",
    [email]
  );
  if (!rows.length) {
    return res.status(401).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
  }

  const user = rows[0];
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" });
  }

  const token = signToken({ userId: user.user_id, email: user.email, role: USER_ROLE });
  res.json({
    token,
    user: { user_id: user.user_id, email: user.email, full_name: user.full_name, role: USER_ROLE },
  });
}

export async function me(req: Request, res: Response) {
  const { rows } = await pool.query(
    "SELECT user_id, email, full_name FROM users WHERE user_id = $1",
    [req.user!.userId]
  );
  if (!rows.length) {
    return res.status(404).json({ error: "ไม่พบผู้ใช้" });
  }
  res.json({ ...rows[0], role: USER_ROLE });
}
