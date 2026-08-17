import { pool } from "../config/db";
import { ResultSetHeader, RowDataPacket } from "mysql2";

const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
const MESSAGING_API = "https://api.line.me/v2/bot/message/push";

export async function sendTextToCustomer(
  customerId: number,
  text: string,
  kind: "QUOTE" | "STATUS" | "REMINDER" | "OTHER" = "OTHER"
): Promise<boolean> {
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      "SELECT line_user_id FROM customers WHERE customer_id = ?",
      [customerId]
    );
    const customer = rows[0];

    if (!customer?.line_user_id) {
      await logNotification(customerId, kind, text, "", "FAILED");
      return false;
    }

    if (!CHANNEL_ACCESS_TOKEN) {
      await logNotification(customerId, kind, text, "", "FAILED");
      return false;
    }

    const res = await fetch(MESSAGING_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        to: customer.line_user_id,
        messages: [{ type: "text", text }],
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

async function logNotification(
  customerId: number,
  kind: "QUOTE" | "STATUS" | "REMINDER" | "OTHER",
  content: string,
  lineMessageId: string,
  status: "SENT" | "FAILED"
) {
  await pool.query<ResultSetHeader>(
    `INSERT INTO line_notifications (customer_id, kind, content, line_message_id, status, sent_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [customerId, kind, content, lineMessageId || null, status]
  );
}
