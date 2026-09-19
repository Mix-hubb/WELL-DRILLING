import { Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import crypto from "crypto";
import { pool } from "../config/db";
import { authMiddleware } from "./auth";

const UPLOAD_DIR = path.join(__dirname, "../../uploads");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`);
  },
});

const ALLOWED = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf"];
const ALLOWED_MIME: Record<string, string[]> = {
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".webp": ["image/webp"],
  ".gif": ["image/gif"],
  ".pdf": ["application/pdf"],
};

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED.includes(ext) || !ALLOWED_MIME[ext]?.includes(file.mimetype)) {
      return cb(new Error("ชนิดไฟล์ไม่ถูกต้อง รองรับเฉพาะรูปภาพหรือ PDF เท่านั้น"));
    }
    cb(null, true);
  },
});

export async function magicAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return authMiddleware(req, res, next);
  }

  const magic =
    (req.params.token as string) ||
    (req.query.magic as string) ||
    (req.headers["x-magic-token"] as string) ||
    (req.body?.magic_token as string);

  if (!magic) return res.status(401).json({ error: "ต้องระบุ magic token" });

  try {
    const { rows } = await pool.query(
      `SELECT job_id AS id FROM drilling_jobs
        WHERE magic_link_token = $1 AND (magic_link_expires_at IS NULL OR magic_link_expires_at > NOW())
       UNION
       SELECT repair_id AS id FROM repair_requests
        WHERE magic_link_token = $2 AND (magic_link_expires_at IS NULL OR magic_link_expires_at > NOW())`,
      [magic, magic]
    );

    if (!rows.length) return res.status(403).json({ error: "ลิงก์ไม่ถูกต้องหรือหมดอายุ" });
    next();
  } catch {
    res.status(500).json({ error: "ไม่สามารถตรวจสอบลิงก์ได้" });
  }
}
