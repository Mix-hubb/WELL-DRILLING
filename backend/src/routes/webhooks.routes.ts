import { Router, Request, Response } from "express";
import crypto from "crypto";
import { pool } from "../config/db";
import { asyncHandler } from "../utils/asyncHandler";

import { broadcast } from "../services/sse";

const router = Router();

interface OrgLineConfig {
  org_id: string;
  line_channel_secret: string;
  line_channel_access_token: string;
  line_liff_id_drilling: string | null;
  line_liff_id_repair: string | null;
}

async function getOrgByBotUserId(destination: string, rawBody: Buffer, signature: string): Promise<OrgLineConfig | null> {
  // วิธีที่ 1: หาองค์กรด้วย line_bot_user_id (ตรงกับ body.destination)
  const { rows } = await pool.query(
    `SELECT org_id, line_channel_secret, line_channel_access_token,
            line_liff_id_drilling, line_liff_id_repair
     FROM organizations WHERE line_bot_user_id = $1`,
    [destination]
  );
  if (rows[0]) return rows[0];

  // วิธีที่ 2 (fallback): สแกนทุก org แล้วตรวจลายเซ็น ใช้สำหรับองค์กรที่ยังไม่ได้ตั้งค่า bot_user_id
  if (rawBody && signature) {
    const { rows: allOrgs } = await pool.query(
      `SELECT org_id, line_channel_secret, line_channel_access_token,
              line_liff_id_drilling, line_liff_id_repair
       FROM organizations WHERE line_channel_access_token IS NOT NULL AND line_bot_user_id IS NULL`
    );
    for (const org of allOrgs) {
      if (org.line_channel_secret && verifySignature(rawBody, signature, org.line_channel_secret)) {
        // พบองค์กร บันทึก bot_user_id ไว้เพื่อใช้ครั้งต่อไป
        pool.query("UPDATE organizations SET line_bot_user_id = $1 WHERE org_id = $2", [destination, org.org_id]).catch(() => {});
        console.log(`[webhook] Mapped destination ${destination} -> org ${org.org_id} via signature scan`);
        return org;
      }
    }
  }
  return null;
}

function verifySignature(rawBody: Buffer, signature: string, channelSecret: string): boolean {
  if (!channelSecret) return true;
  const hmac = crypto.createHmac("sha256", channelSecret).update(rawBody).digest("base64");
  return hmac === signature;
}

async function reply(accessToken: string, replyToken: string, text: string) {
  if (!accessToken) return;
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  });
}

async function replyFlex(accessToken: string, replyToken: string, altText: string, contents: any) {
  if (!accessToken) return;
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "flex", altText, contents }],
    }),
  });
}

function displayDate(value: unknown): string {
  if (!value) return "-";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

function flexText(text: string, options: Record<string, unknown> = {}) {
  return { type: "text", text, size: "sm", wrap: true, ...options };
}
function parseProblems(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function buildWellInfoFlex(customerName: string, wells: any[]) {
  const bubbles = wells.slice(0, 12).map((well) => ({
    type: "bubble",
    size: "giga",
    header: {
      type: "box", layout: "vertical", backgroundColor: "#315A49",
      contents: [flexText(well.well_name || `บ่อ #${well.well_id}`, { color: "#FFFFFF", weight: "bold", size: "lg" })],
    },
    body: {
      type: "box", layout: "vertical", spacing: "md",
      contents: [
        flexText(`คุณ${customerName}`, { color: "#6B7280", size: "xs" }),
        flexText(`รหัสบ่อ: #${well.well_id}`),
        flexText(`ความลึก: ${well.total_depth_m ?? "-"} เมตร`),
        flexText(`ปริมาณน้ำ: ${well.water_quantity_m3hr ?? "-"} ลบ.ม./ชม.`),
        flexText(`อัตราการไหล: ${well.yield_lpm ?? "-"} ลิตร/นาที`),
        flexText(`เจาะเสร็จ: ${displayDate(well.completion_date)}`, { color: "#6B7280" }),
      ],
    },
  }));
  return { type: "carousel", contents: bubbles };
}

function buildWarrantyFlex(wells: any[]) {
  const bubbles = wells.slice(0, 12).map((well) => {
    const active = well.warranty_status === "ACTIVE";
    const expired = well.warranty_status === "EXPIRED";
    const status = active
      ? `อยู่ในประกัน เหลือ ${well.days_left ?? 0} วัน`
      : expired ? "หมดอายุแล้ว" : "ยังไม่มีวันที่เจาะเสร็จ";
    const color = active ? "#2E7D32" : expired ? "#C62828" : "#757575";
    return {
      type: "bubble",
      size: "giga",
      header: {
        type: "box", layout: "vertical", backgroundColor: color,
        contents: [flexText(well.well_name || `บ่อ #${well.well_id}`, { color: "#FFFFFF", weight: "bold", size: "lg" })],
      },
      body: {
        type: "box", layout: "vertical", spacing: "md",
        contents: [
          flexText(status, { weight: "bold", color }),
          flexText(`วันหมดอายุ: ${displayDate(well.warranty_expire_date)}`),
          flexText("หากต้องการนัดตรวจหรือซ่อม พิมพ์ “แจ้งซ่อม” ได้เลยครับ", { color: "#6B7280", size: "xs" }),
        ],
      },
    };
  });
  return { type: "carousel", contents: bubbles };
}

function buildRepairHistoryFlex(repairs: any[]) {
  const statusMap: Record<string, string> = {
    NEW: "รับเรื่องแล้ว", QUOTED: "รอพิจารณาราคา", ACCEPTED: "รับงานแล้ว",
    SCHEDULED: "นัดหมายแล้ว", IN_PROGRESS: "กำลังซ่อม", COMPLETED: "ซ่อมเสร็จแล้ว",
    CLOSED: "ปิดงานแล้ว", REJECTED: "ไม่รับงาน", CANCELLED: "ยกเลิกแล้ว",
  };
  const bubbles = repairs.slice(0, 12).map((repair) => {
    const problems = parseProblems(repair.problems);
    return {
      type: "bubble",
      size: "giga",
      header: {
        type: "box", layout: "vertical", backgroundColor: "#8C5A2B",
        contents: [flexText("ประวัติการซ่อม", { color: "#FFFFFF", weight: "bold", size: "lg" })],
      },
      body: {
        type: "box", layout: "vertical", spacing: "md",
        contents: [
          flexText(`วันที่แจ้ง: ${displayDate(repair.created_at)}`, { color: "#6B7280", size: "xs" }),
          flexText(Array.isArray(problems) && problems.length ? problems.join(", ") : "งานซ่อมบำรุง", { weight: "bold" }),
          flexText(`สถานะ: ${statusMap[repair.status] || repair.status}`),
          ...(repair.price != null ? [flexText(`ยอดล่าสุด: ${Number(repair.price).toLocaleString("th-TH")} บาท`, { weight: "bold", color: "#8C5A2B" })] : []),
        ],
      },
    };
  });
  return { type: "carousel", contents: bubbles };
}

async function findOrCreateCustomerByLine(userId: string, profile: any, orgId: string | null): Promise<number> {
  const { rows } = await pool.query(
    "SELECT customer_id, org_id FROM customers WHERE line_user_id = $1",
    [userId]
  );
  if (rows.length) {
    if (profile?.displayName) {
      await pool.query(
        "UPDATE customers SET line_display_name = COALESCE($1, line_display_name), line_picture_url = COALESCE($2, line_picture_url) WHERE customer_id = $3",
        [profile.displayName, profile.pictureUrl || null, rows[0].customer_id]
      );
    }
    if (orgId && (!rows[0].org_id || rows[0].org_id !== orgId)) {
      await pool.query(
        "UPDATE customers SET org_id = $1 WHERE customer_id = $2",
        [orgId, rows[0].customer_id]
      );
    }
    return rows[0].customer_id;
  }

  const name = profile?.displayName || "ลูกค้า LINE";
  const placeholderPhone = (userId.startsWith("U") ? userId.slice(0, 20) : userId).replace(/\W/g, "");
  const result = await pool.query(
    "INSERT INTO customers (line_user_id, customer_name, phone, line_display_name, line_picture_url, org_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING customer_id",
    [userId, name, placeholderPhone, profile?.displayName || null, profile?.pictureUrl || null, orgId]
  );
  return result.rows[0].customer_id;
}

async function handleText(userId: string, text: string, replyToken: string, org: OrgLineConfig) {
  const custResult = await pool.query(
    "SELECT customer_id, customer_name FROM customers WHERE line_user_id = $1",
    [userId]
  );

  if (/แจ้งเจาะ|ขุดเจาะ|เจาะบ่อ/.test(text)) {
    const liffId = org.line_liff_id_drilling;
    const liffUrl = liffId
      ? `https://liff.line.me/${liffId}/request-drill?liffId=${liffId}`
      : `${process.env.APP_URL || "http://localhost:5173"}/request-drill`;
    return reply(org.line_channel_access_token, replyToken,
      "เปิดฟอร์มแจ้งเจาะบ่อบาดาลได้เลยครับ:\n" + liffUrl
    );
  }

  if (/แจ้งซ่อม|ซ่อมแซม|ซ่อมบำรุง/.test(text)) {
    const liffId = org.line_liff_id_repair;
    const liffUrl = liffId
      ? `https://liff.line.me/${liffId}/repair-form?liffId=${liffId}`
      : `${process.env.APP_URL || "http://localhost:5173"}/repair-form`;
    return reply(org.line_channel_access_token, replyToken,
      "เปิดฟอร์มแจ้งซ่อมบ่อบาดาลได้เลยครับ:\n" + liffUrl
    );
  }

  if (!custResult.rows.length) {
    return reply(org.line_channel_access_token, replyToken, "ยังไม่มีข้อมูลบ่อของคุณในระบบ กรุณาแจ้งเจาะก่อนครับ");
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
      return replyFlex(
        org.line_channel_access_token,
        replyToken,
        `ข้อมูลบ่อของคุณ ${wells.rows.length} บ่อ`,
        buildWellInfoFlex(customer.customer_name, wells.rows),
      );
    }
  } else if (/ประกัน|รับประกัน|หมดอายุ/.test(text)) {
    if (!wells.rows.length) {
      lines.push("ยังไม่มีข้อมูลบ่อในระบบครับ");
    } else {
      return replyFlex(
        org.line_channel_access_token,
        replyToken,
        "สถานะประกันบ่อของคุณ",
        buildWarrantyFlex(wells.rows),
      );
    }
  } else if (/ประวัติซ่อม|การซ่อม|ซ่อมครั้ง/.test(text)) {
    if (!repairs.rows.length) {
      lines.push("ยังไม่มีประวัติการซ่อมครับ");
    } else {
      return replyFlex(
        org.line_channel_access_token,
        replyToken,
        "ประวัติการซ่อมล่าสุดของคุณ",
        buildRepairHistoryFlex(repairs.rows),
      );
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

  return reply(org.line_channel_access_token, replyToken, lines.join("\n"));
}

async function handleImage(userId: string, messageId: string, org: OrgLineConfig, replyToken?: string) {
  const custResult = await pool.query(
    "SELECT customer_id FROM customers WHERE line_user_id = $1",
    [userId]
  );
  if (!custResult.rows.length) {
    if (replyToken) reply(org.line_channel_access_token, replyToken, "ไม่พบข้อมูลลูกค้าในระบบ กรุณาแจ้งเจาะก่อนครับ").catch(() => {});
    return;
  }
  const customerId = custResult.rows[0].customer_id;

  // หา repair_request ล่าสุดที่สถานะเป็น CLOSED (รอชำระเงิน)
  const repairResult = await pool.query(
    `SELECT repair_id FROM repair_requests
     WHERE customer_id = $1 AND status = 'CLOSED'
     ORDER BY updated_at DESC LIMIT 1`,
    [customerId]
  );

  if (!repairResult.rows.length) {
    // ไม่มีงานที่รอชำระ อาจเป็นรูปทั่วไป ไม่ต้องตอบกลับ
    return;
  }
  const repairId = repairResult.rows[0].repair_id;

  // ดึงรูปจาก LINE Content API
  let imageUrl: string | null = null;
  try {
    const contentRes = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
      headers: { Authorization: `Bearer ${org.line_channel_access_token}` },
    });
    if (contentRes.ok) {
      const buffer = Buffer.from(await contentRes.arrayBuffer());
      imageUrl = `data:image/jpeg;base64,${buffer.toString("base64")}`;
    }
  } catch (err) {
    console.error("[webhook] Failed to fetch image content:", err);
  }

  await pool.query(
    `INSERT INTO payment_slips (repair_id, customer_id, image_url, line_message_id, status)
     VALUES ($1, $2, $3, $4, 'PENDING')`,
    [repairId, customerId, imageUrl, messageId]
  );

  broadcast({ type: "PAYMENT_SLIP_RECEIVED", data: { repair_id: repairId }, orgId: org.org_id });

  if (replyToken) {
    reply(org.line_channel_access_token, replyToken,
      "รับสลิปโอนเงินเรียบร้อยครับ ทีมงานจะตรวจสอบและยืนยันการชำระเงินในไม่ช้านี้ครับ ขอบคุณครับ"
    ).catch(() => {});
  }
}

async function handlePostback(userId: string, data: string, org: OrgLineConfig, replyToken?: string) {
  console.log(`[postback] Processing: userId=${userId} data="${data}" org=${org.org_id}`);

  const custResult = await pool.query(
    "SELECT customer_id, customer_name, org_id FROM customers WHERE line_user_id = $1",
    [userId]
  );
  if (!custResult.rows.length) {
    console.warn(`[postback] No customer found for line_user_id=${userId}`);
    if (replyToken) reply(org.line_channel_access_token, replyToken, "ไม่พบข้อมูลลูกค้าในระบบครับ").catch(() => {});
    return;
  }
  const customerId = custResult.rows[0].customer_id;
  console.log(`[postback] Found customer: id=${customerId} name=${custResult.rows[0].customer_name} org_id=${custResult.rows[0].org_id}`);

  if (!custResult.rows[0].org_id) {
    await pool.query("UPDATE customers SET org_id = $1 WHERE customer_id = $2", [org.org_id, customerId]);
  } else if (custResult.rows[0].org_id !== org.org_id) {
    console.warn(`[postback] Customer ${customerId} org_id=${custResult.rows[0].org_id} but webhook org=${org.org_id}, processing anyway`);
  }

  const acceptDrillMatch = data.match(/^accept_drill_(.+)$/);
  const rejectDrillMatch = data.match(/^reject_drill_(.+)$/);
  const acceptRepairMatch = data.match(/^accept_repair_(.+)$/);
  const rejectRepairMatch = data.match(/^reject_repair_(.+)$/);

  console.log(`[postback] Match results: acceptDrill=${!!acceptDrillMatch} rejectDrill=${!!rejectDrillMatch} acceptRepair=${!!acceptRepairMatch} rejectRepair=${!!rejectRepairMatch}`);

  if (acceptDrillMatch) {
    const requestId = acceptDrillMatch[1];
    console.log(`[postback] Accepting drilling request ${requestId}`);
    const existing = await pool.query(
      "SELECT status, customer_id FROM drilling_requests WHERE request_id = $1", [requestId]
    );
    if (!existing.rows.length) { console.warn(`[postback] Drilling request ${requestId} not found`); return; }
    if (existing.rows[0].customer_id !== customerId) { console.warn(`[postback] Customer mismatch: request owner=${existing.rows[0].customer_id} presser=${customerId}`); return; }
    if (existing.rows[0].status !== "QUOTED") {
      if (replyToken) reply(org.line_channel_access_token, replyToken, "คำร้องนี้ได้รับการดำเนินการแล้วครับ").catch(() => {});
      return;
    }

    await pool.query("UPDATE drilling_requests SET status = 'ACCEPTED' WHERE request_id = $1", [requestId]);
    await pool.query("UPDATE quotations SET status = 'ACCEPTED' WHERE kind = 'DRILLING' AND drilling_request_id = $1", [requestId]);

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

    broadcast({ type: "DRILLING_REQUEST_CHANGED", data: { request_id: Number(requestId), status: "ACCEPTED" }, orgId: org.org_id });
    broadcast({ type: "JOB_CREATED", data: { request_id: Number(requestId) }, orgId: org.org_id });

    const { sendTextToCustomerById } = await import("../services/line");
    sendTextToCustomerById(customerId, "ยอมรับเรียบร้อยครับ จะดำเนินการเข้าคิวเจาะให้ต่อไป", "STATUS", org.org_id).catch(() => {});
  } else if (rejectDrillMatch) {
    const requestId = rejectDrillMatch[1];
    const existing = await pool.query(
      "SELECT status, customer_id FROM drilling_requests WHERE request_id = $1", [requestId]
    );
    if (!existing.rows.length) return;
    if (existing.rows[0].customer_id !== customerId) return;
    if (existing.rows[0].status !== "QUOTED") {
      if (replyToken) reply(org.line_channel_access_token, replyToken, "คำร้องนี้ได้รับการดำเนินการแล้วครับ").catch(() => {});
      return;
    }

    await pool.query("UPDATE drilling_requests SET status = 'REJECTED' WHERE request_id = $1", [requestId]);
    await pool.query("UPDATE quotations SET status = 'REJECTED' WHERE kind = 'DRILLING' AND drilling_request_id = $1", [requestId]);

    broadcast({ type: "DRILLING_REQUEST_CHANGED", data: { request_id: Number(requestId), status: "REJECTED" }, orgId: org.org_id });
    broadcast({ type: "QUOTATION_CHANGED", data: { drilling_request_id: Number(requestId) }, orgId: org.org_id });

    const { sendTextToCustomerById } = await import("../services/line");
    sendTextToCustomerById(customerId, "ไม่เป็นไรครับ หากรู้สึกเปลี่ยนใจสามารถแจ้งเจาะใหม่ได้ตลอดเวลา", "STATUS", org.org_id).catch(() => {});
  } else if (acceptRepairMatch) {
    const repairId = acceptRepairMatch[1];
    const existing = await pool.query(
      "SELECT status, customer_id FROM repair_requests WHERE repair_id = $1", [repairId]
    );
    if (!existing.rows.length) return;
    if (existing.rows[0].customer_id !== customerId) return;
    if (existing.rows[0].status !== "QUOTED") {
      if (replyToken) reply(org.line_channel_access_token, replyToken, "คำร้องนี้ได้รับการดำเนินการแล้วครับ").catch(() => {});
      return;
    }

    await pool.query("UPDATE repair_requests SET status = 'ACCEPTED' WHERE repair_id = $1", [repairId]);
    await pool.query("UPDATE quotations SET status = 'ACCEPTED' WHERE kind = 'REPAIR' AND repair_request_id = $1", [repairId]);

    const reqResult = await pool.query(
      "SELECT scheduled_date FROM repair_requests WHERE repair_id = $1", [repairId]
    );
    const scheduledDate = reqResult.rows[0]?.scheduled_date;
    const dateText = scheduledDate ? `วันที่ ${scheduledDate}` : "กำหนดนัดหมาย";

    broadcast({ type: "REPAIR_REQUEST_CHANGED", data: { repair_id: Number(repairId), status: "ACCEPTED" }, orgId: org.org_id });
    broadcast({ type: "QUOTATION_CHANGED", data: { repair_request_id: Number(repairId) }, orgId: org.org_id });

    const { sendTextToCustomerById } = await import("../services/line");
    sendTextToCustomerById(customerId, `ยอมรับเรียบร้อยครับ กรุณาเตรียมตัวสำหรับการซ่อมบำรุง${dateText} ทีมงานจะติดต่อกลับเพื่อยืนยันอีกครั้ง`, "STATUS", org.org_id).catch(() => {});
  } else if (rejectRepairMatch) {
    const repairId = rejectRepairMatch[1];
    const existing = await pool.query(
      "SELECT status, customer_id FROM repair_requests WHERE repair_id = $1", [repairId]
    );
    if (!existing.rows.length) return;
    if (existing.rows[0].customer_id !== customerId) return;
    if (existing.rows[0].status !== "QUOTED") {
      if (replyToken) reply(org.line_channel_access_token, replyToken, "คำร้องนี้ได้รับการดำเนินการแล้วครับ").catch(() => {});
      return;
    }

    await pool.query("UPDATE repair_requests SET status = 'REJECTED' WHERE repair_id = $1", [repairId]);
    await pool.query("UPDATE quotations SET status = 'REJECTED' WHERE kind = 'REPAIR' AND repair_request_id = $1", [repairId]);

    broadcast({ type: "REPAIR_REQUEST_CHANGED", data: { repair_id: Number(repairId), status: "REJECTED" }, orgId: org.org_id });
    broadcast({ type: "QUOTATION_CHANGED", data: { repair_request_id: Number(repairId) }, orgId: org.org_id });

    const { sendTextToCustomerById } = await import("../services/line");
    sendTextToCustomerById(customerId, "ไม่เป็นไรครับ หากรู้สึกเปลี่ยนใจสามารถแจ้งซ่อมใหม่ได้ตลอดเวลา", "STATUS", org.org_id).catch(() => {});
  }
}

router.post(
  "/line",
  asyncHandler(async (req: Request, res: Response) => {
    const raw = (req as any).rawBody as Buffer;
    const signature = req.headers["x-line-signature"] as string;
    const body = req.body;
    const destination = body?.destination as string | undefined;

    console.log(`[LINE webhook] destination=${destination} events=${body?.events?.length || 0}`);

    if (!destination) {
      return res.status(400).json({ error: "No destination" });
    }

    const org = await getOrgByBotUserId(destination, raw, signature);
    if (!org) {
      console.warn(`[LINE webhook] No org found for destination (bot_user_id): ${destination}`);
      return res.json({ ok: true });
    }

    if (raw && signature && !verifySignature(raw, signature, org.line_channel_secret)) {
      console.warn(`[LINE webhook] Invalid signature for org: ${org.org_id}`);
      return res.status(400).json({ error: "Invalid signature" });
    }

    const events = body?.events || [];
    for (const event of events) {
      const userId = event.source?.userId;
      if (!userId) continue;
      await findOrCreateCustomerByLine(userId, undefined, org.org_id);

      console.log(`[LINE webhook] event type=${event.type} userId=${userId}`);

      try {
        if (event.type === "message" && event.message?.type === "text") {
          await handleText(userId, event.message.text, event.replyToken, org);
        } else if (event.type === "message" && event.message?.type === "image") {
          await handleImage(userId, event.message.id, org, event.replyToken);
        } else if (event.type === "postback") {
          console.log(`[LINE webhook] postback data=${event.postback?.data}`);
          await handlePostback(userId, event.postback?.data || "", org, event.replyToken);
        }
      } catch (err) {
        console.error(`[LINE webhook] Error handling event:`, err);
      }
    }

    res.json({ ok: true });
  })
);

export default router;
