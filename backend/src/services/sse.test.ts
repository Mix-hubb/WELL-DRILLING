import { describe, it, expect, vi } from "vitest";

const { mockSend, mockChannel } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockChannel: vi.fn(() => ({ send: mockSend })),
}));

vi.mock("../config/supabase", () => ({
  supabase: { channel: mockChannel },
}));

import { broadcast } from "./sse";

describe("sse (supabase realtime)", () => {
  it("broadcast sends to org channel when orgId is provided", () => {
    broadcast({ type: "JOB_CREATED", data: { job_id: 1 }, orgId: "org-123" });
    expect(mockChannel).toHaveBeenCalledWith("org:org-123");
    expect(mockSend).toHaveBeenCalledWith({
      type: "broadcast",
      event: "JOB_CREATED",
      payload: { job_id: 1 },
    });
  });

  it("broadcast sends to global channel when no orgId", () => {
    mockSend.mockClear();
    mockChannel.mockClear();
    broadcast({ type: "PUMP_CATALOG_CREATED", data: { model_id: 1 } });
    expect(mockChannel).toHaveBeenCalledWith("global");
    expect(mockSend).toHaveBeenCalledWith({
      type: "broadcast",
      event: "PUMP_CATALOG_CREATED",
      payload: { model_id: 1 },
    });
  });
});
