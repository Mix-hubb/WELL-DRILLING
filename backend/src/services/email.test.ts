import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendResetCodeEmail } from "./email";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, text: async () => "" });
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.RESEND_FROM = "Well-Drilling <onboarding@resend.dev>";
});

describe("sendResetCodeEmail", () => {
  it("sends an email via the Resend API with the reset code", async () => {
    await sendResetCodeEmail("user@example.com", "123456");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(options.method).toBe("POST");
    expect(options.headers.Authorization).toBe("Bearer re_test_key");

    const body = JSON.parse(options.body);
    expect(body.to).toBe("user@example.com");
    expect(body.from).toBe("Well-Drilling <onboarding@resend.dev>");
    expect(body.subject).toContain("รหัสยืนยัน");
    expect(body.html).toContain("123456");
  });

  it("falls back to a default from address when RESEND_FROM is unset", async () => {
    delete process.env.RESEND_FROM;
    await sendResetCodeEmail("user@example.com", "000000");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.from).toBe("Well-Drilling <onboarding@resend.dev>");
  });

  it("throws when RESEND_API_KEY is not configured", async () => {
    delete process.env.RESEND_API_KEY;
    await expect(sendResetCodeEmail("user@example.com", "123456")).rejects.toThrow("RESEND_API_KEY");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws when Resend responds with a non-ok status", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 422, text: async () => "invalid from address" });
    await expect(sendResetCodeEmail("user@example.com", "123456")).rejects.toThrow("Resend HTTP 422");
  });
});
