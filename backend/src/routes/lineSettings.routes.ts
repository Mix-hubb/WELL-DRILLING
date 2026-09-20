import { Router, Request, Response } from "express";
import { pool } from "../config/db";
import { asyncHandler } from "../utils/asyncHandler";
import { adminMiddleware } from "../middleware/auth";
import { createUniqueInviteCode } from "../services/inviteCode";
import { broadcast } from "../services/sse";
import { sanitizeLiffId } from "../utils/liffId";

const router = Router();

router.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { rows } = await pool.query(
            `SELECT o.org_id, o.name, o.slug,
              CASE WHEN u.role = 'ADMIN' THEN o.invite_code ELSE NULL END AS invite_code,
              o.line_channel_id,
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
    if (req.user!.role === "ADMIN" && !org.invite_code) {
      const code = await createUniqueInviteCode((sql, params) => pool.query(sql, params));
      await pool.query("UPDATE organizations SET invite_code = $1 WHERE org_id = $2", [code, org.org_id]);
      org.invite_code = code;
    }
    res.json({
      ...org,
      line_channel_secret: org.line_channel_secret ? "••••••••" : null,
      line_channel_access_token: org.line_channel_access_token ? "••••••••" : null,
    });
  })
);

router.get(
  "/check-liff",
  asyncHandler(async (req: Request, res: Response) => {
    const liff_id = sanitizeLiffId(req.query.liff_id);
    if (!liff_id) {
      return res.status(400).json({ error: "ต้องระบุ liff_id" });
    }

    const { rows: myOrg } = await pool.query(
      `SELECT o.org_id FROM organizations o
       JOIN users u ON u.org_id = o.org_id
       WHERE u.user_id = $1`,
      [req.user!.userId]
    );
    const myOrgId = myOrg[0]?.org_id;

    const { rows } = await pool.query(
      `SELECT org_id, name FROM organizations
       WHERE (line_liff_id_drilling = $1 OR line_liff_id_repair = $1)
       AND org_id != $2
       ORDER BY created_at ASC LIMIT 1`,
      [liff_id, myOrgId]
    );

    if (!rows.length) {
      return res.json({ available: true });
    }

    const org = rows[0];
    res.json({
      available: false,
      used_by: { org_id: org.org_id, org_name: org.name },
    });
  })
);

router.put(
  "/",
  adminMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const {
      line_channel_id, line_channel_secret, line_channel_access_token,
      line_liff_id_drilling: rawLiffDrilling, line_liff_id_repair: rawLiffRepair,
    } = req.body;
    const line_liff_id_drilling = rawLiffDrilling === undefined ? undefined : (sanitizeLiffId(rawLiffDrilling) || null);
    const line_liff_id_repair = rawLiffRepair === undefined ? undefined : (sanitizeLiffId(rawLiffRepair) || null);

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
    const client = await pool.connect();
    let newBotUserId: string | null = null;

    try {
      await client.query("BEGIN");

      // ปลดการผูก LINE ที่ค้างในองค์กรอื่น (เช่น องค์กรทดสอบ) เพื่อไม่ให้ชน unique index
      if (line_channel_id) {
        await client.query(
          `UPDATE organizations
           SET line_channel_id = NULL,
               line_channel_secret = NULL,
               line_channel_access_token = NULL,
               line_bot_user_id = NULL
           WHERE line_channel_id = $1 AND org_id != $2`,
          [line_channel_id, orgId]
        );
      }
      if (line_liff_id_drilling) {
        await client.query(
          "UPDATE organizations SET line_liff_id_drilling = NULL WHERE line_liff_id_drilling = $1 AND org_id != $2",
          [line_liff_id_drilling, orgId]
        );
      }
      if (line_liff_id_repair) {
        await client.query(
          "UPDATE organizations SET line_liff_id_repair = NULL WHERE line_liff_id_repair = $1 AND org_id != $2",
          [line_liff_id_repair, orgId]
        );
      }

      const updates: string[] = [];
      const params: any[] = [];
      let idx = 1;

      if (line_channel_id !== undefined) { updates.push(`line_channel_id = $${idx++}`); params.push(line_channel_id || null); }
      if (line_channel_secret !== undefined && line_channel_secret !== "••••••••") { updates.push(`line_channel_secret = $${idx++}`); params.push(line_channel_secret || null); }

      const isNewToken = line_channel_access_token !== undefined && line_channel_access_token !== "••••••••" && line_channel_access_token;
      let tokenToFetch = isNewToken ? line_channel_access_token : null;

      if (isNewToken) {
        updates.push(`line_channel_access_token = $${idx++}`);
        params.push(line_channel_access_token);
      } else {
        const orgRow = await client.query(
          "SELECT line_channel_access_token, line_bot_user_id FROM organizations WHERE org_id = $1",
          [orgId]
        );
        if (orgRow.rows.length && orgRow.rows[0].line_channel_access_token && !orgRow.rows[0].line_bot_user_id) {
          tokenToFetch = orgRow.rows[0].line_channel_access_token;
        }
      }

      if (tokenToFetch) {
        try {
          const botInfoRes = await fetch("https://api.line.me/v2/bot/info", {
            headers: { Authorization: `Bearer ${tokenToFetch}` },
          });
          if (botInfoRes.ok) {
            const botInfo: any = await botInfoRes.json();
            newBotUserId = botInfo.userId || null;
            if (newBotUserId) {
              await client.query(
                "UPDATE organizations SET line_bot_user_id = NULL WHERE line_bot_user_id = $1",
                [newBotUserId]
              );
              updates.push(`line_bot_user_id = $${idx++}`);
              params.push(newBotUserId);
              console.log(`[lineSettings] Successfully linked bot user ID ${newBotUserId} to org ${orgId}`);
            }
          } else {
            console.warn(`[lineSettings] Could not fetch bot info: ${botInfoRes.status}`);
          }
        } catch (err) {
          console.warn(`[lineSettings] Error fetching bot info:`, err);
        }
      }

      if (line_liff_id_drilling !== undefined) { updates.push(`line_liff_id_drilling = $${idx++}`); params.push(line_liff_id_drilling); }
      if (line_liff_id_repair !== undefined) { updates.push(`line_liff_id_repair = $${idx++}`); params.push(line_liff_id_repair); }

      if (!updates.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "ไม่มีข้อมูลที่ต้องอัปเดต" });
      }

      params.push(orgId);
      await client.query(
        `UPDATE organizations SET ${updates.join(", ")} WHERE org_id = $${idx}`,
        params
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    broadcast({ type: "LINE_SETTINGS_CHANGED", data: {}, orgId });

    res.json({ ok: true, message: "บันทึกสำเร็จ", bot_user_id: newBotUserId || undefined });
  })
);

export default router;
