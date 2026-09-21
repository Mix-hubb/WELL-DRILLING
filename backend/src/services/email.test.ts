import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendResetCodeEmail } from "./email";

const { mockSend } = vi.hoisted(() => ({
  mockSend: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

vi.hoisted(() => {
  process.env.RESEND_API_KEY = "re_test-key";
  process.env.RESEND_FROM = "Well-Drilling <onboarding@resend.dev>";
});

beforeEach(() => {
  mockSend.mockReset();
  mockSend.mockResolvedValue({ id: "test-id" });
});

describe("sendResetCodeEmail", () => {
  it("sends an email to the address with the reset code", async () => {
    await sendResetCodeEmail("user@example.com", "123456");

    expect(mockSend).toHaveBeenCalledTimes(1);
    const opts = mockSend.mock.calls[0][0];
    expect(opts.to).toBe("user@example.com");
    expect(opts.from).toBe("Well-Drilling <onboarding@resend.dev>");
    expect(opts.subject).toContain("รหัสยืนยัน");
    expect(opts.html).toContain("123456");
  });

  it("propagates failures from the Resend API", async () => {
    mockSend.mockRejectedValueOnce(new Error("resend down"));
    await expect(sendResetCodeEmail("user@example.com", "123456")).rejects.toThrow("resend down");
  });
});
