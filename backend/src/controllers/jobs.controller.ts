import { Request, Response } from "express";
import { pool } from "../config/db";
import { RowDataPacket, ResultSetHeader } from "mysql2";
import { userFilter, userWhere } from "../utils/userFilter";

function jobSelect(req: Request) {
  const { sql, params } = userWhere(req);
  return {
    select: `
      SELECT j.*,
             c.customer_name, c.phone AS customer_phone, c.phone_alt,
             (SELECT well_id FROM well_logs w WHERE w.job_id = j.job_id LIMIT 1) AS well_id,
             (SELECT w2.warranty_expire_date FROM well_logs w2 WHERE w2.job_id = j.job_id LIMIT 1) AS warranty_expire_date
      FROM drilling_jobs j
      JOIN customers c ON c.customer_id = j.customer_id
      ${sql}`,
    params,
  };
}

export async function list(req: Request, res: Response) {
  const { status } = req.query;
  const { select, params } = jobSelect(req);
  const where = status ? " AND j.status = ?" : " AND j.status != 'ARCHIVED'";
  const [rows] = await pool.query<RowDataPacket[]>(
    `${select} ${where} ORDER BY j.scheduled_date DESC`,
    status ? [...params, status] : params
  );
  res.json(rows);
}

export async function getOne(req: Request, res: Response) {
  const { select, params } = jobSelect(req);
  const [rows] = await pool.query<RowDataPacket[]>(
    `${select} AND j.job_id = ?`, [...params, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: "ไม่พบคิวงาน" });
  res.json(rows[0]);
}

export async function create(req: Request, res: Response) {
  const {
    customer_id, job_title, site_address,
    province, district, latitude, longitude,
    scheduled_date, requested_depth_m, priority, notes,
  } = req.body;

  if (!customer_id || !job_title || !site_address || !scheduled_date) {
    return res.status(400).json({
      error: "ข้อมูลไม่ครบ: customer_id, job_title, site_address, scheduled_date",
    });
  }

  // ตรวจสอบว่า customer เป็นของผู้ใช้นี้ (หรือเป็น ADMIN)
  if (req.user!.role !== "ADMIN") {
    const [custCheck] = await pool.query<RowDataPacket[]>(
      "SELECT customer_id FROM customers WHERE customer_id = ? AND user_id = ?",
      [customer_id, req.user!.userId]
    );
    if (!custCheck.length) {
      return res.status(403).json({ error: "ไม่มีสิทธิ์สร้างงานให้ลูกค้ารายนี้" });
    }
  }

  const year = new Date().getFullYear();
  const [[countRow]] = await pool.query<RowDataPacket[]>(
    "SELECT COUNT(*) AS cnt FROM drilling_jobs WHERE YEAR(created_at) = ?", [year]
  );
  const seq = String((Number(countRow.cnt) || 0) + 1).padStart(4, "0");
  const job_reference = `WEL-${year}-${seq}`;

  const [result] = await pool.query<ResultSetHeader>(`
    INSERT INTO drilling_jobs
      (job_reference, customer_id, job_title, site_address, province, district,
       latitude, longitude, scheduled_date, requested_depth_m, priority, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    job_reference, customer_id, job_title, site_address,
    province || "", district || "",
    latitude || null, longitude || null,
    scheduled_date, requested_depth_m || 0,
    priority || "NORMAL", notes || null,
  ]);

  const { select, params } = jobSelect(req);
  const [rows] = await pool.query<RowDataPacket[]>(
    `${select} AND j.job_id = ?`, [...params, result.insertId]
  );
  res.status(201).json(rows[0]);
}

export async function updateStatus(req: Request, res: Response) {
  const { status } = req.body;
  const valid = ["PENDING", "DRILLING", "COMPLETED", "ARCHIVED"];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `status ต้องเป็นหนึ่งใน ${valid.join(", ")}` });
  }
  const { sql: uf, params: up } = userFilter(req, "c");
  await pool.query(
    `UPDATE drilling_jobs j JOIN customers c ON c.customer_id = j.customer_id
     SET j.status = ? WHERE j.job_id = ?${uf}`,
    [status, req.params.id, ...up]
  );
  const { select, params } = jobSelect(req);
  const [rows] = await pool.query<RowDataPacket[]>(
    `${select} AND j.job_id = ?`, [...params, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: "ไม่พบคิวงาน" });
  res.json(rows[0]);
}

export async function remove(req: Request, res: Response) {
  const { sql: uf, params: up } = userFilter(req, "c");
  await pool.query(
    `DELETE j FROM drilling_jobs j JOIN customers c ON c.customer_id = j.customer_id
     WHERE j.job_id = ?${uf}`,
    [req.params.id, ...up]
  );
  res.status(204).end();
}
