import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  broadcast: vi.fn(),
}));

vi.mock("../config/db", () => ({ pool: { query: mocks.poolQuery } }));
vi.mock("../services/sse", () => ({ broadcast: mocks.broadcast }));

import { handlePostback } from "./webhooks.routes";

const org = {
  org_id: "org-1",
  line_channel_secret: "secret",
  line_channel_access_token: "token",
  line_liff_id_drilling: null,
  line_liff_id_repair: null,
};

function setupAcceptFlow(requestNotes: string | null) {
  mocks.poolQuery.mockImplementation(async (sql: string) => {
    if (sql.includes("SELECT customer_id, customer_name, org_id FROM customers")) {
      return { rows: [{ customer_id: "cust-1", customer_name: "นายทดสอบ", org_id: "org-1" }] };
    }
    if (sql.includes("SELECT r.status, r.customer_id FROM drilling_requests")) {
      return { rows: [{ status: "QUOTED", customer_id: "cust-1" }] };
    }
    if (sql.includes("SELECT name, address, requested_depth_m, appointment_date, notes")) {
      return { rows: [{ name: "นายทดสอบ", address: "กรุงเทพ", requested_depth_m: null, appointment_date: null, notes: requestNotes }] };
    }
    return { rows: [] };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("handlePostback accept_drill", () => {
  it("appends the (บ่อที่ N) label from notes to the job title", async () => {
    setupAcceptFlow("บ่อที่ 2");

    await handlePostback("line-user-1", "accept_drill_req-1", org, "reply-token");

    const insertJob = mocks.poolQuery.mock.calls.find((c) => String(c[0]).includes("INSERT INTO drilling_jobs"));
    expect(insertJob).toBeDefined();
    expect(insertJob![1][2]).toBe("เจาะบ่อ นายทดสอบ (บ่อที่ 2)");
  });

  it("falls back to the plain job title when notes has no well label", async () => {
    setupAcceptFlow(null);

    await handlePostback("line-user-1", "accept_drill_req-1", org, "reply-token");

    const insertJob = mocks.poolQuery.mock.calls.find((c) => String(c[0]).includes("INSERT INTO drilling_jobs"));
    expect(insertJob![1][2]).toBe("เจาะบ่อ นายทดสอบ");
  });

  it("keeps only the well-count prefix when notes has extra free text after it", async () => {
    setupAcceptFlow("บ่อที่ 3\nอยู่หลังบ้าน");

    await handlePostback("line-user-1", "accept_drill_req-1", org, "reply-token");

    const insertJob = mocks.poolQuery.mock.calls.find((c) => String(c[0]).includes("INSERT INTO drilling_jobs"));
    expect(insertJob![1][2]).toBe("เจาะบ่อ นายทดสอบ (บ่อที่ 3)");
  });
});
