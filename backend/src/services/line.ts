import { pool } from "../config/db";

const MESSAGING_API = "https://api.line.me/v2/bot/message/push";

export function buildLineNoticeFlex(text: string, title = "แจ้งเตือนจากระบบ") {
  const urlMatch = text.match(/https?:\/\/[^\s]+/);
  const rawUrl = urlMatch?.[0];
  const url = rawUrl?.replace(/[)。，、]+$/, "");
  const bodyText = rawUrl ? text.replace(rawUrl, "").trim() : text;

  return {
    type: "bubble",
    size: "giga",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#315A49",
      paddingAll: "lg",
      contents: [{ type: "text", text: title, color: "#FFFFFF", weight: "bold", size: "lg", wrap: true }],
    },
    body: {
      type: "box",
      layout: "vertical",
      paddingAll: "lg",
      contents: [{ type: "text", text: bodyText || text, color: "#1F2937", size: "sm", wrap: true }],
    },
    ...(url ? {
      footer: {
        type: "box",
        layout: "vertical",
        paddingAll: "md",
        contents: [{
          type: "button",
          style: "primary",
          color: "#315A49",
          action: { type: "uri", label: "เปิดลิงก์", uri: url },
        }],
      },
    } : {}),
  };
}

async function getAccessTokenForCustomer(customerId: number, fallbackOrgId?: string | null): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT c.org_id, o.line_channel_access_token
     FROM customers c
     JOIN organizations o ON c.org_id = o.org_id
     WHERE c.customer_id = $1`,
    [customerId]
  );
  if (rows[0]?.line_channel_access_token) return rows[0].line_channel_access_token;

  if (fallbackOrgId && rows[0]?.org_id === fallbackOrgId) {
    const { rows: orgRows } = await pool.query(
      "SELECT line_channel_access_token FROM organizations WHERE org_id = $1",
      [fallbackOrgId]
    );
    if (orgRows[0]?.line_channel_access_token) {
      return orgRows[0].line_channel_access_token;
    }
  }
  return null;
}

export async function sendTextToCustomerById(
  customerId: number,
  text: string,
  kind: "QUOTE" | "STATUS" | "REMINDER" | "OTHER" = "OTHER",
  fallbackOrgId?: string | null
): Promise<boolean> {
  try {
    const { rows } = await pool.query(
      "SELECT line_user_id FROM customers WHERE customer_id = $1",
      [customerId]
    );
    const customer = rows[0];

    if (!customer?.line_user_id) {
      await logNotification(customerId, kind, text, "", "FAILED");
      return false;
    }

    const accessToken = await getAccessTokenForCustomer(customerId, fallbackOrgId);
    if (!accessToken) {
      await logNotification(customerId, kind, text, "", "FAILED");
      return false;
    }

    const res = await fetch(MESSAGING_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to: customer.line_user_id,
        messages: [{
          type: "flex",
          altText: text.slice(0, 400),
          contents: buildLineNoticeFlex(text),
        }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("LINE push failed:", res.status, body);
      await logNotification(customerId, kind, text, "", "FAILED");
      return false;
    }

    const data: any = await res.json();
    await logNotification(customerId, kind, text, data.sentMessages?.[0]?.id || "", "SENT");
    return true;
  } catch (err) {
    console.error("LINE send error:", err);
    await logNotification(customerId, kind, text, "", "FAILED").catch(() => {});
    return false;
  }
}

export async function sendFlexToCustomerById(
  customerId: number,
  altText: string,
  flexContent: any,
  kind: "QUOTE" | "STATUS" | "REMINDER" | "OTHER" = "OTHER",
  fallbackOrgId?: string | null
): Promise<boolean> {
  try {
    const { rows } = await pool.query(
      "SELECT line_user_id FROM customers WHERE customer_id = $1",
      [customerId]
    );
    const customer = rows[0];

    if (!customer?.line_user_id) {
      await logNotification(customerId, kind, altText, "", "FAILED");
      return false;
    }

    const accessToken = await getAccessTokenForCustomer(customerId, fallbackOrgId);
    if (!accessToken) {
      console.log(`[LINE] would send flex (no token for org): ${altText}`);
      await logNotification(customerId, kind, altText, "", "FAILED");
      return false;
    }

    const res = await fetch(MESSAGING_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        to: customer.line_user_id,
        messages: [{
          type: "flex",
          altText,
          contents: flexContent,
        }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error("LINE flex push failed:", res.status, body);
      await logNotification(customerId, kind, altText, "", "FAILED");
      return false;
    }

    const data: any = await res.json();
    await logNotification(customerId, kind, altText, data.sentMessages?.[0]?.id || "", "SENT");
    return true;
  } catch (err) {
    console.error("LINE flex send error:", err);
    await logNotification(customerId, kind, altText, "", "FAILED").catch(() => {});
    return false;
  }
}

export async function sendTextToCustomer(
  customerId: number,
  text: string,
  kind: "QUOTE" | "STATUS" | "REMINDER" | "OTHER" = "OTHER",
  fallbackOrgId?: string | null
): Promise<boolean> {
  return sendTextToCustomerById(customerId, text, kind, fallbackOrgId);
}

export async function sendFlexToCustomer(
  customerId: number,
  altText: string,
  flexContent: any,
  kind: "QUOTE" | "STATUS" | "REMINDER" | "OTHER" = "OTHER",
  fallbackOrgId?: string | null
): Promise<boolean> {
  return sendFlexToCustomerById(customerId, altText, flexContent, kind, fallbackOrgId);
}

async function logNotification(
  customerId: number,
  kind: "QUOTE" | "STATUS" | "REMINDER" | "OTHER",
  content: string,
  lineMessageId: string,
  status: "SENT" | "FAILED"
) {
  await pool.query(
    `INSERT INTO line_notifications (customer_id, kind, content, line_message_id, status, sent_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [customerId, kind, content, lineMessageId || null, status]
  );
}

export function buildRepairReceiptFlex(options: {
  receiptNo: string;
  customerName: string;
  repairId: number | string;
  wellName?: string | null;
  workDetails?: string | null;
  parts?: Array<{ name: string; qty: number; unit_price: number }>;
  finalPrice?: number | null;
  isWarrantyClaim?: boolean;
  pdfUrl: string;
}) {
  const isWarranty = Boolean(options.isWarrantyClaim);
  const priceText = isWarranty
    ? "เคลมประกัน (0 บาท)"
    : options.finalPrice != null
      ? `${Number(options.finalPrice).toLocaleString("th-TH")} บาท`
      : "—";

  const partsSummary = options.parts && options.parts.length > 0
    ? options.parts.map((p) => `• ${p.name} x${p.qty}`).slice(0, 4).join("\n")
    : "";

  return {
    type: "bubble",
    size: "giga",
    header: {
      type: "box",
      layout: "vertical",
      backgroundColor: "#1B5E20",
      paddingAll: "lg",
      contents: [
        {
          type: "text",
          text: "ใบเสร็จรับเงิน / ผลการซ่อม",
          weight: "bold",
          color: "#FFFFFF",
          size: "lg",
        },
        {
          type: "text",
          text: `เลขที่: ${options.receiptNo}`,
          color: "#C8E6C9",
          size: "xs",
          margin: "xs",
        },
      ],
    },
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      paddingAll: "lg",
      contents: [
        {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          contents: [
            { type: "text", text: `คุณ${options.customerName}`, weight: "bold", size: "md", color: "#111827" },
            { type: "text", text: `รหัสงานซ่อม: #${options.repairId}${options.wellName ? ` · ${options.wellName}` : ""}`, size: "xs", color: "#6B7280" },
          ],
        },
        { type: "separator", color: "#E5E7EB" },
        {
          type: "box",
          layout: "vertical",
          spacing: "xs",
          contents: [
            { type: "text", text: "รายละเอียดการซ่อม:", size: "xs", color: "#6B7280" },
            { type: "text", text: options.workDetails || "ซ่อมบำรุงระบบบ่อบาดาลเรียบร้อยแล้ว", size: "sm", wrap: true, color: "#1F2937" },
            ...(partsSummary ? [
              { type: "text", text: "รายการอะไหล่:", size: "xs", color: "#6B7280", margin: "sm" },
              { type: "text", text: partsSummary, size: "xs", color: "#374151", wrap: true },
            ] : []),
          ],
        },
        { type: "separator", color: "#E5E7EB" },
        {
          type: "box",
          layout: "horizontal",
          contents: [
            { type: "text", text: "ยอดสุทธิ:", weight: "bold", size: "md", color: "#111827", flex: 3 },
            { type: "text", text: priceText, weight: "bold", size: "md", color: isWarranty ? "#2E7D32" : "#8C5A2B", align: "right", flex: 5 },
          ],
        },
      ],
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      paddingAll: "md",
      contents: [
        {
          type: "button",
          style: "primary",
          color: "#1B5E20",
          height: "sm",
          action: {
            type: "uri",
            label: "📄 ดาวน์โหลดใบเสร็จ (PDF)",
            uri: options.pdfUrl,
          },
        },
      ],
    },
  };
}
