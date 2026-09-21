const RESEND_API_URL = "https://api.resend.com/emails";

export async function sendResetCodeEmail(email: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY ไม่ได้ตั้งค่า ไม่สามารถส่งอีเมลได้");
  }
  const from = process.env.RESEND_FROM || "Well-Drilling <onboarding@resend.dev>";

  const res = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: "รหัสยืนยันการเปลี่ยนรหัสผ่าน — Well-Drilling",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h2 style="color: #4A6278;">รหัสยืนยันของคุณ</h2>
          <p>ใช้รหัสนี้เพื่อเปลี่ยนรหัสผ่าน:</p>
          <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px;
                      text-align: center; padding: 20px; margin: 20px 0;
                      background: #F7F3EB; border-radius: 12px; color: #2E2418;">
            ${code}
          </div>
          <p style="color: #8A8078; font-size: 14px;">รหัสนี้จะหมดอายุใน 10 นาที<br/>หากคุณไม่ได้ขอเปลี่ยนรหัสผ่าน กรุณาเพิกเฉยต่ออีเมลนี้</p>
          <hr style="border: none; border-top: 1px solid #E6DDD1; margin: 24px 0;" />
          <p style="color: #8A8078; font-size: 12px;">Well-Drilling — ระบบจัดการบ่อบาดาลแบบดิจิทัล</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`ส่งอีเมลไม่สำเร็จ (Resend HTTP ${res.status}): ${body}`);
  }
}
