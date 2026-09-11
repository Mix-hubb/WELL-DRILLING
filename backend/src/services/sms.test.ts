import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { twilioFactory } = vi.hoisted(() => ({ twilioFactory: vi.fn() }));
vi.mock("twilio", () => ({ default: twilioFactory }));

describe("sendResetCodeSms", () => {
  let sms: typeof import("./sms");
  const client = { messages: { create: vi.fn().mockResolvedValue({ sid: "SM1" }) } };

  beforeEach(async () => {
    vi.resetModules();
    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "tok";
    process.env.TWILIO_PHONE_NUMBER = "+15000000000";
    twilioFactory.mockReset();
    twilioFactory.mockReturnValue(client);
    client.messages.create.mockClear();
    client.messages.create.mockResolvedValue({ sid: "SM1" });
    sms = await import("./sms.js");
  });

  afterEach(() => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
  });

  it("sends a Thai OTP message via twilio", async () => {
    await sms.sendResetCodeSms("0812345678", "123456");
    expect(client.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "[Well-Drilling] รหัสยืนยันของคุณคือ 123456 (หมดอายุใน 10 นาที)",
        from: "+15000000000",
        to: "0812345678",
      })
    );
  });

  it("throws when twilio env vars are missing", async () => {
    vi.resetModules();
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_PHONE_NUMBER;
    const unconfigured = await import("./sms.js");
    await expect(unconfigured.sendResetCodeSms("0812345678", "111111")).rejects.toThrow(
      "SMS service not configured"
    );
  });

  it("throws when the phone from-number is missing", async () => {
    vi.resetModules();
    delete process.env.TWILIO_PHONE_NUMBER;
    const noFrom = await import("./sms.js");
    await expect(noFrom.sendResetCodeSms("0812345678", "111111")).rejects.toThrow(
      "SMS service not configured"
    );
  });
});