import { Router, Request, Response } from "express";
import crypto from "crypto";
import { pool } from "../config/db";
import { ResultSetHeader, RowDataPacket } from "mysql2";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || "";
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";

function verifySignature(rawBody: Buffer, signature: string): boolean {
  if (!CHANNEL_SECRET) return true;
  const hmac = crypto.createHmac("sha256", CHANNEL_SECRET).update(rawBody).digest("base64");
  return hmac === signature;
}

async function reply(replyToken: string, text: string) {
  if (!CHANNEL_ACCESS_TOKEN) {
    console.log(`[LINE webhook] would reply (no token): ${text}`);
    return;
  }
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  });
}

async function findOrCreateCustomerByLine(userId: string, profile: any): Promise<number> {
  const [rows] = await pool.query<RowDataPacket[]>(
    "SELECT customer_id FROM customers WHERE line_user_id = ?",
    [userId]
  );
  if (rows.length) {
    if (profile?.displayName) {
      await pool.query(
        "UPDATE customers SET line_display_name = COALESCE(?, line_display_name), line_picture_url = COALESCE(?, line_picture_url) WHERE customer_id = ?",
        [profile.displayName, profile.pictureUrl || null, rows[0].customer_id]
      );
    }
    return rows[0].customer_id;
  }

  const name = profile?.displayName || "ลูกค้า LINE";
  const placeholderPhone = (userId.startsWith("U") ? userId.slice(0, 20) : userId).replace(/\W/g, "");
  const [result] = await pool.query<ResultSetHeader>(
    "INSERT INTO customers (line_user_id, customer_name, phone, line_display_name, line_picture_url) VALUES (?, ?, ?, ?, ?)",
    [userId, name, placeholderPhone, profile?.displayName || null, profile?.pictureUrl || null]
  );
  return result.insertId;
}

async function handleText(userId: string, text: string, replyToken: string) {
  const [custRows] = await pool.query<RowDataPacket[]>(
    "SELECT customer_id, customer_name FROM customers WHERE line_user_id = ?",
    [userId]
  );
  if (!custRows.length) {
    return reply(replyToken, "ยังไม่มีข้อมูลบ่อของคุณในระบบ กรุณาแจ้งเจาะก่อนครับ");
  }
  const customer = custRows[0];

  const [wells] = await pool.query<RowDataPacket[]>(
    `SELECT
       w.well_id, w.well_name, w.total_depth_m, w.water_quantity_m3hr, w.yield_lpm,
       w.completion_date, w.warranty_expire_date,
       wv.warranty_status, wv.days_left
     FROM wells w
     LEFT JOIN well_warranty_view wv ON wv.well_id = w.well_id
     WHERE w.customer_id = ?
     ORDER BY w.created_at DESC`,
    [customer.customer_id]
  );

  const [repairs] = await pool.query<RowDataPacket[]>(
    `SELECT r.repair_id, r.status, r.problems, r.created_at,
            COALESCE(rec.final_price, q.price) AS price
     FROM repair_requests r
     LEFT JOIN repair_records rec ON rec.repair_id = r.repair_id
     LEFT JOIN quotations q ON q.kind = 'REPAIR' AND q.repair_request_id = r.repair_id
     WHERE r.customer_id = ?
     ORDER BY r.created_at DESC
     LIMIT 5`,
    [customer.customer_id]
  );

  const lines: string[] = [];

  if (/ดูข้อมูลบ่อ|ข้อมูลบ่อ|บ่อของฉัน/.test(text)) {
    if (!wells.length) {
      lines.push("ยังไม่มีข้อมูลบ่อในระบบครับ");
    } else {
      lines.push(`คุณ ${customer.customer_name} มีบ่อทั้งหมด ${wells.length} บ่อ`);
      wells.forEach((w) => {
        lines.push(
          `• ${w.well_name} (บ่อ #${w.well_id})\n` +
          `  ความลึก ${w.total_depth_m ?? "-"} ม. | น้ำ ${w.water_quantity_m3hr ?? "-"} ลบ.ม./ชม. | อัตรา ${w.yield_lpm ?? "-"} ลิตร/นาที`
        );
      });
    }
  } else if (/ประกัน|รับประกัน|หมดอายุ/.test(text)) {
    if (!wells.length) {
      lines.push("ยังไม่มีข้อมูลบ่อในระบบครับ");
    } else {
      wells.forEach((w) => {
        const status =
          w.warranty_status === "ACTIVE"
            ? `อยู่ในประกัน (เหลือ ${w.days_left} วัน ถึง ${w.warranty_expire_date})`
            : w.warranty_status === "EXPIRED"
              ? "ประกันหมดอายุแล้ว"
              : "ยังไม่มีวันที่เจาะเสร็จ";
        lines.push(`• ${w.well_name}: ${status}`);
      });
    }
  } else if (/ประวัติซ่อม|การซ่อม|ซ่อมครั้ง/.test(text)) {
    if (!repairs.length) {
      lines.push("ยังไม่มีประวัติการซ่อมครับ");
    } else {
      lines.push("ประวัติการซ่อมล่าสุด:");
      repairs.forEach((r) => {
        const problems = typeof r.problems === "string" ? JSON.parse(r.problems) : (r.problems || []);
        lines.push(
          `• แจ้ง ${r.created_at?.toISOString?.().slice(0, 10) ?? r.created_at} — ${problems.join(", ")}` +
          `\n  สถานะ ${r.status}${r.price ? ` | ราคา ${Number(r.price).toLocaleString("th-TH")} บาท` : ""}`
        );
      });
    }
  } else {
    lines.push(
      "พิมพ์คำสั่งต่อไปนี้:\n" +
      "• ข้อมูลบ่อ — ดูรายละเอียดบ่อ\n" +
      "• ประกัน — ดูสถานะประกัน\n" +
      "• ประวัติซ่อม — ดูประวัติการซ่อม"
    );
  }

  return reply(replyToken, lines.join("\n"));
}

router.post(
  "/google-form",
  asyncHandler(async (req: Request, res: Response) => {
    const body: any = req.body || {};
    const name = body.name || body.NAME || body.customer_name;
    const phone = String(body.phone || body.PHONE || body.phone_number || "").replace(/\D/g, "");
    const address = body.address || body.ADDRESS || body.site_address || null;
    const depth = body.requested_depth_m || body.depth || null;

    if (!name || !phone) {
      return res.status(400).json({ error: "ต้องระบุชื่อและเบอร์โทร" });
    }

    const [existing] = await pool.query<RowDataPacket[]>(
      "SELECT customer_id FROM customers WHERE phone = ? LIMIT 1",
      [phone]
    );
    let customerId: number;
    if (existing.length) {
      customerId = existing[0].customer_id;
      await pool.query(
        "UPDATE customers SET customer_name = COALESCE(?, customer_name), address = COALESCE(?, address) WHERE customer_id = ?",
        [name, address, customerId]
      );
    } else {
      const [c] = await pool.query<ResultSetHeader>(
        "INSERT INTO customers (customer_name, phone, address) VALUES (?, ?, ?)",
        [name, phone, address]
      );
      customerId = c.insertId;
    }

    const [r] = await pool.query<ResultSetHeader>(
      `INSERT INTO drilling_requests (customer_id, source, name, phone, address, requested_depth_m)
       VALUES (?, 'GOOGLE_FORM', ?, ?, ?, ?)`,
      [customerId, name, phone, address, depth ?? null]
    );

    res.status(201).json({ request_id: r.insertId, customer_id: customerId });
  })
);

router.post(
  "/line",
  asyncHandler(async (req: Request, res: Response) => {
    const raw = (req as any).rawBody as Buffer;
    const signature = req.headers["x-line-signature"] as string;
    if (raw && signature && !verifySignature(raw, signature)) {
      return res.status(400).json({ error: "Invalid signature" });
    }

    const body = req.body;
    const events = body?.events || [];
    for (const event of events) {
      if (event.type !== "message" || event.message?.type !== "text") continue;
      const userId = event.source?.userId;
      if (!userId) continue;
      await findOrCreateCustomerByLine(userId, undefined);
      await handleText(userId, event.message.text, event.replyToken);
    }

    res.json({ ok: true });
  })
);

export default router;
