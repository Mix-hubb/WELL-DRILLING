import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendResetCodeEmail(email: string, code: string): Promise<void> {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@well-drilling.com";

  await transporter.sendMail({
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
