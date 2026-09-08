import { Router, Request, Response } from "express";
import { pool } from "../config/db";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { rows } = await pool.query(
      `SELECT o.org_id, o.name, o.slug, o.invite_code,
              o.line_channel_secret,
              o.line_channel_access_token, o.line_liff_id_drilling, o.line_liff_id_repair,
              o.created_at
       FROM organizations o
       JOIN users u ON u.org_id = o.org_id
       WHERE u.user_id = $1`,
      [req.user!.userId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: "ไม่พบองค์กร" });
    }
    const org = rows[0];
    res.json({
      ...org,
      line_channel_secret: org.line_channel_secret ? "••••••••" : null,
      line_channel_access_token: org.line_channel_access_token ? "••••••••" : null,
    });
  })
);

router.put(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const {
      line_channel_secret, line_channel_access_token,
      line_liff_id_drilling, line_liff_id_repair,
    } = req.body;

    const { rows: orgRows } = await pool.query(
      `SELECT o.org_id FROM organizations o
       JOIN users u ON u.org_id = o.org_id
       WHERE u.user_id = $1`,
      [req.user!.userId]
    );
    if (!orgRows.length) {
      return res.status(404).json({ error: "ไม่พบองค์กร" });
    }
    const orgId = orgRows[0].org_id;

    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (line_channel_secret !== undefined && line_channel_secret !== "••••••••") { updates.push(`line_channel_secret = $${idx++}`); params.push(line_channel_secret || null); }
    if (line_channel_access_token !== undefined && line_channel_access_token !== "••••••••") { updates.push(`line_channel_access_token = $${idx++}`); params.push(line_channel_access_token || null); }
    if (line_liff_id_drilling !== undefined) { updates.push(`line_liff_id_drilling = $${idx++}`); params.push(line_liff_id_drilling || null); }
    if (line_liff_id_repair !== undefined) { updates.push(`line_liff_id_repair = $${idx++}`); params.push(line_liff_id_repair || null); }

    if (!updates.length) {
      return res.status(400).json({ error: "ไม่มีข้อมูลที่ต้องอัปเดต" });
    }

    params.push(orgId);
    await pool.query(
      `UPDATE organizations SET ${updates.join(", ")} WHERE org_id = $${idx}`,
      params
    );

    res.json({ ok: true, message: "บันทึกสำเร็จ" });
  })
);

export default router;
