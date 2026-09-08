import { pool } from "../config/db";

const MESSAGING_API = "https://api.line.me/v2/bot/message/push";

async function getAccessTokenForCustomer(customerId: number): Promise<string | null> {
  const { rows } = await pool.query(
    `SELECT o.line_channel_access_token
     FROM customers c
     JOIN organizations o ON c.org_id = o.org_id
     WHERE c.customer_id = $1`,
    [customerId]
  );
  return rows[0]?.line_channel_access_token || null;
}

export async function sendTextToCustomerById(
  customerId: number,
  text: string,
  kind: "QUOTE" | "STATUS" | "REMINDER" | "OTHER" = "OTHER"
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

    const accessToken = await getAccessTokenForCustomer(customerId);
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

export async function sendFlexToCustomerById(
  customerId: number,
  altText: string,
  flexContent: any,
  kind: "QUOTE" | "STATUS" | "REMINDER" | "OTHER" = "OTHER"
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

    const accessToken = await getAccessTokenForCustomer(customerId);
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
  kind: "QUOTE" | "STATUS" | "REMINDER" | "OTHER" = "OTHER"
): Promise<boolean> {
  return sendTextToCustomerById(customerId, text, kind);
}

export async function sendFlexToCustomer(
  customerId: number,
  altText: string,
  flexContent: any,
  kind: "QUOTE" | "STATUS" | "REMINDER" | "OTHER" = "OTHER"
): Promise<boolean> {
  return sendFlexToCustomerById(customerId, altText, flexContent, kind);
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
