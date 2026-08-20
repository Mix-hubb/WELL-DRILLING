import { Router, Request, Response } from "express";
import crypto from "crypto";
import { pool } from "../config/db";
import { asyncHandler } from "../utils/asyncHandler";
import { sendTextToCustomer } from "../services/line";

const router = Router();

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET || "";
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
const LIFF_ID_DRILLING = process.env.LINE_LIFF_ID_DRILLING || "";
const LIFF_ID_REPAIR = process.env.LINE_LIFF_ID_REPAIR || "";

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
  const { rows } = await pool.query(
    "SELECT customer_id FROM customers WHERE line_user_id = $1",
    [userId]
  );
  if (rows.length) {
    if (profile?.displayName) {
      await pool.query(
        "UPDATE customers SET line_display_name = COALESCE($1, line_display_name), line_picture_url = COALESCE($2, line_picture_url) WHERE customer_id = $3",
        [profile.displayName, profile.pictureUrl || null, rows[0].customer_id]
      );
    }
    return rows[0].customer_id;
  }

  const name = profile?.displayName || "ลูกค้า LINE";
  const placeholderPhone = (userId.startsWith("U") ? userId.slice(0, 20) : userId).replace(/\W/g, "");
  const result = await pool.query(
    "INSERT INTO customers (line_user_id, customer_name, phone, line_display_name, line_picture_url) VALUES ($1, $2, $3, $4, $5) RETURNING customer_id",
    [userId, name, placeholderPhone, profile?.displayName || null, profile?.pictureUrl || null]
  );
  return result.rows[0].customer_id;
}

async function handleText(userId: string, text: string, replyToken: string) {
  const custResult = await pool.query(
    "SELECT customer_id, customer_name FROM customers WHERE line_user_id = $1",
    [userId]
  );

  if (/แจ้งเจาะ|ขุดเจาะ|เจาะบ่อ/.test(text)) {
    const liffUrl = LIFF_ID_DRILLING
      ? `https://liff.line.me/${LIFF_ID_DRILLING}/request-drill`
      : `${process.env.APP_URL || "http://localhost:5173"}/request-drill`;
    return reply(replyToken,
      "เปิดฟอร์มแจ้งเจาะบ่อบาดาลได้เลยครับ:\n" + liffUrl
    );
  }

  if (/แจ้งซ่อม|ซ่อมแซม|ซ่อมบำรุง/.test(text)) {
    const liffUrl = LIFF_ID_REPAIR
      ? `https://liff.line.me/${LIFF_ID_REPAIR}/repair-form`
      : `${process.env.APP_URL || "http://localhost:5173"}/repair-form`;
    return reply(replyToken,
      "เปิดฟอร์มแจ้งซ่อมบ่อบาดาลได้เลยครับ:\n" + liffUrl
    );
  }

  if (!custResult.rows.length) {
    return reply(replyToken, "ยังไม่มีข้อมูลบ่อของคุณในระบบ กรุณาแจ้งเจาะก่อนครับ");
  }
  const customer = custResult.rows[0];

  const wells = await pool.query(
    `SELECT
       w.well_id, w.well_name, w.total_depth_m, w.water_quantity_m3hr, w.yield_lpm,
       w.completion_date, w.warranty_expire_date,
       wv.warranty_status, wv.days_left
     FROM wells w
     LEFT JOIN well_warranty_view wv ON wv.well_id = w.well_id
     WHERE w.customer_id = $1
     ORDER BY w.created_at DESC`,
    [customer.customer_id]
  );

  const repairs = await pool.query(
    `SELECT r.repair_id, r.status, r.problems, r.created_at,
            COALESCE(rec.final_price, q.price) AS price
     FROM repair_requests r
     LEFT JOIN repair_records rec ON rec.repair_id = r.repair_id
     LEFT JOIN quotations q ON q.kind = 'REPAIR' AND q.repair_request_id = r.repair_id
     WHERE r.customer_id = $1
     ORDER BY r.created_at DESC
     LIMIT 5`,
    [customer.customer_id]
  );

  const lines: string[] = [];

  if (/ดูข้อมูลบ่อ|ข้อมูลบ่อ|บ่อของฉัน|ข้อมูลบ่อของลูกค้า/.test(text)) {
    if (!wells.rows.length) {
      lines.push("ยังไม่มีข้อมูลบ่อในระบบครับ");
    } else {
      lines.push(`คุณ ${customer.customer_name} มีบ่อทั้งหมด ${wells.rows.length} บ่อ`);
      wells.rows.forEach((w: any) => {
        lines.push(
          `• ${w.well_name} (บ่อ #${w.well_id})\n` +
          `  ความลึก ${w.total_depth_m ?? "-"} ม. | น้ำ ${w.water_quantity_m3hr ?? "-"} ลบ.ม./ชม. | อัตรา ${w.yield_lpm ?? "-"} ลิตร/นาที`
        );
      });
    }
  } else if (/ประกัน|รับประกัน|หมดอายุ/.test(text)) {
    if (!wells.rows.length) {
      lines.push("ยังไม่มีข้อมูลบ่อในระบบครับ");
    } else {
      wells.rows.forEach((w: any) => {
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
    if (!repairs.rows.length) {
      lines.push("ยังไม่มีประวัติการซ่อมครับ");
    } else {
      lines.push("ประวัติการซ่อมล่าสุด:");
      repairs.rows.forEach((r: any) => {
        const problems = typeof r.problems === "string" ? JSON.parse(r.problems) : (r.problems || []);
        const createdDate = r.created_at instanceof Date
          ? r.created_at.toISOString().slice(0, 10)
          : String(r.created_at).slice(0, 10);
        lines.push(
          `• แจ้ง ${createdDate} — ${problems.join(", ")}` +
          `\n  สถานะ ${r.status}${r.price ? ` | ราคา ${Number(r.price).toLocaleString("th-TH")} บาท` : ""}`
        );
      });
    }
  } else if (/ประวัติงาน|ประวัติการเจาะ|งานของฉัน/.test(text)) {
    const jobs = await pool.query(
      `SELECT j.job_id, j.job_title, j.status, j.result, j.scheduled_date, j.created_at
       FROM drilling_jobs j WHERE j.customer_id = $1 ORDER BY j.created_at DESC LIMIT 5`,
      [customer.customer_id]
    );
    if (!jobs.rows.length) {
      lines.push("ยังไม่มีประวัติงานขุดเจาะครับ");
    } else {
      lines.push("ประวัติงานขุดเจาะล่าสุด:");
      jobs.rows.forEach((j: any) => {
        const createdDate = j.created_at instanceof Date
          ? j.created_at.toISOString().slice(0, 10)
          : String(j.created_at).slice(0, 10);
        const statusMap: Record<string, string> = {
          QUEUED: "รอคิว", DRILLING: "กำลังเจาะ", SUCCESS: "สำเร็จ",
          FAILED: "ไม่สำเร็จ", CLOSED: "ปิดงาน",
        };
        lines.push(
          `• ${j.job_title || "งาน #" + j.job_id} (${createdDate})\n` +
          `  สถานะ ${statusMap[j.status] || j.status}${j.result ? ` | ผลลัพธ์ ${j.result}` : ""}`
        );
      });
    }
  } else {
    lines.push(
      "พิมพ์คำสั่งต่อไปนี้:\n" +
      "• แจ้งเจาะ — เปิดฟอร์มแจ้งเจาะบ่อใหม่\n" +
      "• แจ้งซ่อม — เปิดฟอร์มแจ้งซ่อมบ่อบาดาล\n" +
      "• ข้อมูลบ่อ — ดูรายละเอียดบ่อ\n" +
      "• ประกัน — ดูสถานะประกัน\n" +
      "• ประวัติงาน — ดูประวัติงานขุดเจาะ\n" +
      "• ประวัติซ่อม — ดูประวัติการซ่อม"
    );
  }

  return reply(replyToken, lines.join("\n"));
}

async function handlePostback(userId: string, data: string) {
  const custResult = await pool.query(
    "SELECT customer_id, customer_name FROM customers WHERE line_user_id = $1",
    [userId]
  );
  if (!custResult.rows.length) return;
  const customerId = custResult.rows[0].customer_id;

  const acceptDrillMatch = data.match(/^accept_drill_(\d+)$/);
  const rejectDrillMatch = data.match(/^reject_drill_(\d+)$/);
  const acceptRepairMatch = data.match(/^accept_repair_(\d+)$/);
  const rejectRepairMatch = data.match(/^reject_repair_(\d+)$/);

  if (acceptDrillMatch) {
    const requestId = Number(acceptDrillMatch[1]);
    await pool.query("UPDATE drilling_requests SET status = 'ACCEPTED' WHERE request_id = $1", [requestId]);

    const reqResult = await pool.query(
      "SELECT name, address, requested_depth_m, appointment_date FROM drilling_requests WHERE request_id = $1",
      [requestId]
    );
    const req = reqResult.rows[0];

    await pool.query(
      `INSERT INTO drilling_jobs (request_id, customer_id, status, job_title, site_address, scheduled_date)
       VALUES ($1, $2, 'QUEUED', $3, $4, $5)`,
      [requestId, customerId, `เจาะบ่อ ${req?.name || ""}`, req?.address || null, req?.appointment_date || null]
    );

    sendTextToCustomer(customerId, "ยอมรับเรียบร้อยครับ จะดำเนินการเข้าคิวเจาะให้ต่อไป", "STATUS").catch(() => {});
  } else if (rejectDrillMatch) {
    const requestId = Number(rejectDrillMatch[1]);
    await pool.query("UPDATE drilling_requests SET status = 'REJECTED' WHERE request_id = $1", [requestId]);
    sendTextToCustomer(customerId, "ไม่เป็นไรครับ หากรู้สึกเปลี่ยนใจสามารถแจ้งเจาะใหม่ได้ตลอดเวลา", "STATUS").catch(() => {});
  } else if (acceptRepairMatch) {
    const repairId = Number(acceptRepairMatch[1]);
    await pool.query("UPDATE repair_requests SET status = 'ACCEPTED' WHERE repair_id = $1", [repairId]);
    await pool.query("UPDATE quotations SET status = 'ACCEPTED' WHERE kind = 'REPAIR' AND repair_request_id = $1", [repairId]);

    const reqResult = await pool.query(
      "SELECT scheduled_date FROM repair_requests WHERE repair_id = $1", [repairId]
    );
    const scheduledDate = reqResult.rows[0]?.scheduled_date;
    const dateText = scheduledDate ? `วันที่ ${scheduledDate}` : "กำหนดนัดหมาย";
    sendTextToCustomer(customerId, `ยอมรับเรียบร้อยครับ กรุณาเตรียมตัวสำหรับการซ่อมบำรุง${dateText} ทีมงานจะติดต่อกลับเพื่อยืนยันอีกครั้ง`, "STATUS").catch(() => {});
  } else if (rejectRepairMatch) {
    const repairId = Number(rejectRepairMatch[1]);
    await pool.query("UPDATE repair_requests SET status = 'REJECTED' WHERE repair_id = $1", [repairId]);
    await pool.query("UPDATE quotations SET status = 'REJECTED' WHERE kind = 'REPAIR' AND repair_request_id = $1", [repairId]);
    sendTextToCustomer(customerId, "ไม่เป็นไรครับ หากรู้สึกเปลี่ยนใจสามารถแจ้งซ่อมใหม่ได้ตลอดเวลา", "STATUS").catch(() => {});
  }
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

    const existing = await pool.query(
      "SELECT customer_id FROM customers WHERE phone = $1 LIMIT 1",
      [phone]
    );
    let customerId: number;
    if (existing.rows.length) {
      customerId = existing.rows[0].customer_id;
      await pool.query(
        "UPDATE customers SET customer_name = COALESCE($1, customer_name), address = COALESCE($2, address) WHERE customer_id = $3",
        [name, address, customerId]
      );
    } else {
      const c = await pool.query(
        "INSERT INTO customers (customer_name, phone, address) VALUES ($1, $2, $3) RETURNING customer_id",
        [name, phone, address]
      );
      customerId = c.rows[0].customer_id;
    }

    const r = await pool.query(
      `INSERT INTO drilling_requests (customer_id, source, name, phone, address, requested_depth_m)
       VALUES ($1, 'GOOGLE_FORM', $2, $3, $4, $5) RETURNING request_id`,
      [customerId, name, phone, address, depth ?? null]
    );

    res.status(201).json({ request_id: r.rows[0].request_id, customer_id: customerId });
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
      const userId = event.source?.userId;
      if (!userId) continue;
      await findOrCreateCustomerByLine(userId, undefined);

      if (event.type === "message" && event.message?.type === "text") {
        await handleText(userId, event.message.text, event.replyToken);
      } else if (event.type === "postback") {
        await handlePostback(userId, event.postback?.data || "");
      }
    }

    res.json({ ok: true });
  })
);

export default router;
