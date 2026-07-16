import { Request, Response } from "express";
import { pool } from "../config/db";
import { RowDataPacket, ResultSetHeader } from "mysql2";

const JOB_SELECT = `
  SELECT j.*,
         c.customer_name, c.phone AS customer_phone, c.phone_alt,
         (SELECT well_id FROM well_logs w WHERE w.job_id = j.job_id LIMIT 1) AS well_id,
         (SELECT w2.warranty_expire_date FROM well_logs w2 WHERE w2.job_id = j.job_id LIMIT 1) AS warranty_expire_date
  FROM drilling_jobs j
  JOIN customers c ON c.customer_id = j.customer_id
`;

export async function list(req: Request, res: Response) {
  const { status } = req.query;
  const where = status ? "WHERE j.status = ?" : "WHERE j.status != 'ARCHIVED'";
  const params = status ? [status] : [];
  const [rows] = await pool.query<RowDataPacket[]>(
    `${JOB_SELECT} ${where} ORDER BY j.scheduled_date DESC`,
    params
  );
  res.json(rows);
}

export async function getOne(req: Request, res: Response) {
  const [rows] = await pool.query<RowDataPacket[]>(
    `${JOB_SELECT} WHERE j.job_id = ?`, [req.params.id]
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

  // สร้าง job_reference: WEL-YYYY-NNNN
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

  const [rows] = await pool.query<RowDataPacket[]>(
    `${JOB_SELECT} WHERE j.job_id = ?`, [result.insertId]
  );
  res.status(201).json(rows[0]);
}

export async function updateStatus(req: Request, res: Response) {
  const { status } = req.body;
  const valid = ["PENDING", "DRILLING", "COMPLETED", "ARCHIVED"];
  if (!valid.includes(status)) {
    return res.status(400).json({ error: `status ต้องเป็นหนึ่งใน ${valid.join(", ")}` });
  }
  await pool.query(
    "UPDATE drilling_jobs SET status = ? WHERE job_id = ?", [status, req.params.id]
  );
  const [rows] = await pool.query<RowDataPacket[]>(
    `${JOB_SELECT} WHERE j.job_id = ?`, [req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: "ไม่พบคิวงาน" });
  res.json(rows[0]);
}

export async function remove(req: Request, res: Response) {
  await pool.query("DELETE FROM drilling_jobs WHERE job_id = ?", [req.params.id]);
  res.status(204).end();
}
