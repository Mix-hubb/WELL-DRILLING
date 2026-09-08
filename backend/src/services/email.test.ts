import { describe, it, expect, vi, beforeEach } from "vitest";
import nodemailer from "nodemailer";
import { sendResetCodeEmail } from "./email";

const { sendMail } = vi.hoisted(() => ({ sendMail: vi.fn() }));

vi.mock("nodemailer", () => ({
  default: { createTransport: vi.fn(() => ({ sendMail })) },
}));

vi.hoisted(() => {
  process.env.SMTP_HOST = "smtp.gmail.com";
  process.env.SMTP_PORT = "587";
  process.env.SMTP_USER = "admin@well-drilling.com";
  process.env.SMTP_PASS = "secret";
  process.env.SMTP_FROM = "from@well-drilling.com";
});

beforeEach(() => {
  sendMail.mockReset();
  sendMail.mockResolvedValue({});
});

describe("sendResetCodeEmail", () => {
  it("sends an email to the address with the reset code", async () => {
    await sendResetCodeEmail("user@example.com", "123456");

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.gmail.com",
        port: 587,
        auth: { user: "admin@well-drilling.com", pass: "secret" },
      })
    );
    expect(sendMail).toHaveBeenCalledTimes(1);
    const opts = sendMail.mock.calls[0][0];
    expect(opts.to).toBe("user@example.com");
    expect(opts.from).toBe("from@well-drilling.com");
    expect(opts.subject).toContain("รหัสยืนยัน");
    expect(opts.html).toContain("123456");
  });

  it("falls back to SMTP_USER as the from address", async () => {
    delete process.env.SMTP_FROM;
    await sendResetCodeEmail("user@example.com", "000000");
    expect(sendMail.mock.calls[0][0].from).toBe("admin@well-drilling.com");
  });

  it("propagates failures from the transporter", async () => {
    sendMail.mockRejectedValueOnce(new Error("smtp down"));
    await expect(sendResetCodeEmail("user@example.com", "123456")).rejects.toThrow("smtp down");
  });
});