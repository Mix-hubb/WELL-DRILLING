import { Request, Response } from "express";
import { pool } from "../config/db";

export async function getOrgInfo(req: Request, res: Response) {
  const orgId = req.user?.orgId;
  if (!orgId) {
    return res.status(400).json({ error: "ผู้ใช้ไม่ได้สังกัดองค์กรใด" });
  }

  const { rows } = await pool.query(
    "SELECT org_id, name, slug, invite_code, created_at FROM organizations WHERE org_id = $1",
    [orgId]
  );
  if (!rows.length) {
    return res.status(404).json({ error: "ไม่พบข้อมูลองค์กร" });
  }

  res.json(rows[0]);
}

export async function getMembers(req: Request, res: Response) {
  const orgId = req.user?.orgId;
  if (!orgId) {
    return res.status(400).json({ error: "ผู้ใช้ไม่ได้สังกัดองค์กรใด" });
  }

  const { rows } = await pool.query(
    `SELECT user_id, email, full_name, phone, role, created_at
     FROM users
     WHERE org_id = $1
     ORDER BY role ASC, full_name ASC`,
    [orgId]
  );

  res.json(rows);
}

export async function updateMemberRole(req: Request, res: Response) {
  const orgId = req.user?.orgId;
  const currentUserId = req.user?.userId;
  const currentRole = req.user?.role;
  const { id } = req.params;
  const { role } = req.body;

  if (currentRole !== "ADMIN") {
    return res.status(403).json({ error: "เฉพาะผู้ดูแลระบบ (ADMIN) เท่านั้นที่สามารถเปลี่ยนบทบาทได้" });
  }

  if (!role || !["ADMIN", "DRILLER"].includes(role)) {
    return res.status(400).json({ error: "บทบาทไม่ถูกต้อง (ต้องเป็น ADMIN หรือ DRILLER)" });
  }

  // Check if target user belongs to this org
  const { rows: targetUsers } = await pool.query(
    "SELECT user_id, role FROM users WHERE user_id = $1 AND org_id = $2",
    [id, orgId]
  );

  if (!targetUsers.length) {
    return res.status(404).json({ error: "ไม่พบสมาชิกในองค์กรนี้" });
  }

  // If demoting from ADMIN, ensure at least one other ADMIN exists
  if (targetUsers[0].role === "ADMIN" && role !== "ADMIN") {
    const { rows: adminCount } = await pool.query(
      "SELECT COUNT(*) as count FROM users WHERE org_id = $1 AND role = 'ADMIN'",
      [orgId]
    );
    if (Number(adminCount[0].count) <= 1) {
      return res.status(400).json({ error: "ไม่สามารถลดระดับผู้ดูแลระบบคนสุดท้ายได้" });
    }
  }

  await pool.query(
    "UPDATE users SET role = $1, updated_at = NOW() WHERE user_id = $2 AND org_id = $3",
    [role, id, orgId]
  );

  res.json({ message: "อัปเดตบทบาทสำเร็จ", role });
}

export async function removeMember(req: Request, res: Response) {
  const orgId = req.user?.orgId;
  const currentUserId = req.user?.userId;
  const currentRole = req.user?.role;
  const { id } = req.params;

  if (currentRole !== "ADMIN") {
    return res.status(403).json({ error: "เฉพาะผู้ดูแลระบบ (ADMIN) เท่านั้นที่สามารถลบสมาชิกได้" });
  }

  // Check if target user belongs to this org
  const { rows: targetUsers } = await pool.query(
    "SELECT user_id, role FROM users WHERE user_id = $1 AND org_id = $2",
    [id, orgId]
  );

  if (!targetUsers.length) {
    return res.status(404).json({ error: "ไม่พบสมาชิกในองค์กรนี้" });
  }

  if (id === currentUserId) {
    return res.status(400).json({ error: "ไม่สามารถลบตัวเองออกจากองค์กรได้" });
  }

  // Unlink member from organization
  await pool.query(
    "UPDATE users SET org_id = NULL, updated_at = NOW() WHERE user_id = $1 AND org_id = $2",
    [id, orgId]
  );

  res.status(204).end();
}
