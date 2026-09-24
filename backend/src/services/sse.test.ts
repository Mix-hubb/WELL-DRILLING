import { describe, it, expect, vi } from "vitest";

const { mockSend, mockChannel, mockLogError } = vi.hoisted(() => ({
  mockSend: vi.fn(() => Promise.resolve()),
  mockChannel: vi.fn(() => ({ send: mockSend })),
  mockLogError: vi.fn(),
}));

vi.mock("../config/supabase", () => ({
  supabase: { channel: mockChannel },
}));

vi.mock("../middleware/observability", () => ({
  logError: mockLogError,
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

  it("does not throw and logs context when the underlying send rejects", async () => {
    mockSend.mockClear();
    mockChannel.mockClear();
    mockLogError.mockClear();
    mockSend.mockReturnValueOnce(Promise.reject(new Error("network down")));

    expect(() =>
      broadcast({ type: "JOB_CREATED", data: { job_id: 9 }, orgId: "org-456" })
    ).not.toThrow();

    // let the rejected promise's .catch() microtask run
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockLogError).toHaveBeenCalledTimes(1);
    const [err, requestId, context] = mockLogError.mock.calls[0];
    expect(err).toBeInstanceOf(Error);
    expect(requestId).toBeUndefined();
    expect(context).toEqual({ source: "broadcast", event: "JOB_CREATED", orgId: "org-456" });
  });
});
