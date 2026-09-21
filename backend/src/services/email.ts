import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendResetCodeEmail(email: string, code: string): Promise<void> {
  const from = process.env.RESEND_FROM || "Well-Drilling <onboarding@resend.dev>";

  await resend.emails.send({
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
  });
}
