import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { pool } from "../config/db";
import { signToken } from "../middleware/auth";
import { UserRole } from "../types";
import { generateCode, hashCode, verifyCode, getCodeExpiry, isCodeExpired } from "../services/resetCode";
import { sendResetCodeEmail } from "../services/email";
import { sendResetCodeSms } from "../services/sms";

const USER_ROLE: UserRole = "DRILLER";

export async function register(req: Request, res: Response) {
  const { email, password, full_name, phone } = req.body;
  if (!email || !password || !full_name || !phone) {
    return res.status(400).json({ error: "ต้องระบุ email, password, ชื่อ-นามสกุล และเบอร์โทรศัพท์" });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "รูปแบบอีเมลไม่ถูกต้อง" });
  }
  if (!/^\d{9,10}$/.test(phone.replace(/[-\s]/g, ""))) {
    return res.status(400).json({ error: "เบอร์โทรศัพท์ต้องเป็นตัวเลข 9-10 หลัก" });
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
  const cleanPhone = phone.replace(/[-\s]/g, "");

  const { rows } = await pool.query(
    "INSERT INTO users (user_id, email, password_hash, full_name, phone, role) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING user_id",
    [email, password_hash, full_name, cleanPhone, USER_ROLE]
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
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "รูปแบบอีเมลไม่ถูกต้อง" });
  }

  const { rows } = await pool.query(
    "SELECT user_id, email, password_hash, full_name, role FROM users WHERE email = $1",
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

  const token = signToken({ userId: user.user_id, email: user.email, role: user.role });
  res.json({
    token,
    user: { user_id: user.user_id, email: user.email, full_name: user.full_name, role: user.role },
  });
}

export async function me(req: Request, res: Response) {
  const { rows } = await pool.query(
    "SELECT user_id, email, full_name, role FROM users WHERE user_id = $1",
    [req.user!.userId]
  );
  if (!rows.length) {
    return res.status(404).json({ error: "ไม่พบผู้ใช้" });
  }
  res.json(rows[0]);
}

export async function forgotPassword(req: Request, res: Response) {
  const { email, method } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "กรุณากรอกอีเมลที่ถูกต้อง" });
  }
  if (!method || !["email", "sms"].includes(method)) {
    return res.status(400).json({ error: "กรุณาเลือกวิธีรับรหัส (email หรือ sms)" });
  }

  const { rows } = await pool.query(
    "SELECT user_id, phone FROM users WHERE email = $1", [email]
  );

  // Always return success to prevent email enumeration
  if (!rows.length) {
    return res.json({ message: "หากอีเมลนี้มีในระบบ จะได้รับรหัสยืนยันเร็วๆ นี้" });
  }

  const user = rows[0];
  const code = generateCode();
  const codeHash = await hashCode(code);
  const expires = getCodeExpiry();

  await pool.query(
    "UPDATE users SET reset_code = $1, reset_expires = $2, reset_method = $3 WHERE user_id = $4",
    [codeHash, expires, method, user.user_id]
  );

  try {
    if (method === "email") {
      await sendResetCodeEmail(email, code);
    } else {
      if (!user.phone) {
        return res.status(400).json({ error: "ไม่พบเบอร์โทรศัท์ในบัญชีนี้ กรุณาเลือกรับรหัสทางอีเมล" });
      }
      await sendResetCodeSms(user.phone, code);
    }
  } catch (sendErr) {
    console.error("Failed to send reset code:", sendErr);
    return res.status(500).json({ error: "ไม่สามารถส่งรหัสยืนยันได้ กรุณาลองใหม่อีกครั้ง" });
  }

  res.json({ message: "ส่งรหัสยืนยันเรียบร้อยแล้ว" });
}

export async function verifyCodeHandler(req: Request, res: Response) {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ error: "กรุณากรอกอีเมลและรหัสยืนยัน" });
  }

  const { rows } = await pool.query(
    "SELECT reset_code, reset_expires FROM users WHERE email = $1", [email]
  );
  if (!rows.length || !rows[0].reset_code) {
    return res.status(400).json({ error: "ไม่พบคำขอรีเซ็ตรหัสผ่าน" });
  }

  const user = rows[0];
  if (isCodeExpired(new Date(user.reset_expires))) {
    return res.status(400).json({ error: "รหัสยืนยันหมดอายุแล้ว กรุณาขอรหัสใหม่" });
  }

  const valid = await verifyCode(code, user.reset_code);
  if (!valid) {
    return res.status(400).json({ error: "รหัสยืนยันไม่ถูกต้อง" });
  }

  res.json({ message: "รหัสยืนยันถูกต้อง" });
}

export async function resetPassword(req: Request, res: Response) {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบทุกช่อง" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร" });
  }

  const { rows } = await pool.query(
    "SELECT user_id, reset_code, reset_expires FROM users WHERE email = $1", [email]
  );
  if (!rows.length || !rows[0].reset_code) {
    return res.status(400).json({ error: "ไม่พบคำขอรีเซ็ตรหัสผ่าน" });
  }

  const user = rows[0];
  if (isCodeExpired(new Date(user.reset_expires))) {
    return res.status(400).json({ error: "รหัสยืนยันหมดอายุแล้ว กรุณาขอรหัสใหม่" });
  }

  const valid = await verifyCode(code, user.reset_code);
  if (!valid) {
    return res.status(400).json({ error: "รหัสยืนยันไม่ถูกต้อง" });
  }

  const password_hash = await bcrypt.hash(newPassword, 10);
  await pool.query(
    "UPDATE users SET password_hash = $1, reset_code = NULL, reset_expires = NULL, reset_method = NULL, updated_at = NOW() WHERE user_id = $2",
    [password_hash, user.user_id]
  );

  res.json({ message: "เปลี่ยนรหัสผ่านสำเร็จ" });
}
