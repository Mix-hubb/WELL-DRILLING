import { describe, it, expect, vi, afterEach } from "vitest";
import type { Response } from "express";
import { addClient, removeClient, broadcast, clientCount } from "./sse";

function createRes() {
  const res: any = {};
  res.write = vi.fn(() => true);
  res.writeHead = vi.fn();
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.on = vi.fn();
  return res;
}

const created: Response[] = [];

function makeClient(orgId?: string | null): Response {
  const res = createRes();
  created.push(res);
  addClient(res, "user-1", orgId ?? null);
  return res;
}

afterEach(() => {
  for (const res of [...created]) {
    removeClient(res);
  }
  created.length = 0;
});

describe("sse", () => {
  it("starts at zero clients", () => {
    expect(clientCount()).toBe(0);
  });

  it("addClient writes SSE headers and wire handshake", () => {
    const res = createRes();
    created.push(res);
    expect(addClient(res, "user-1", "org-1")).toBe(true);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      "Content-Type": "text/event-stream",
    }));
    expect(res.write).toHaveBeenCalledWith(": connected\n\n");
    expect(clientCount()).toBe(1);
  });

  it("registers a close handler to remove the client", () => {
    const res = createRes();
    created.push(res);
    addClient(res, "user-1", "org-1");
    const closeHandler = (res.on as any).mock.calls.find((c: any[]) => c[0] === "close")?.[1];
    expect(typeof closeHandler).toBe("function");
    closeHandler();
    expect(clientCount()).toBe(0);
  });

  it("broadcasts to all clients when no org is specified", () => {
    const a = makeClient();
    const b = makeClient();
    broadcast({ type: "JOB_CREATED", data: { job_id: 1 } });
    expect(a.write).toHaveBeenCalledWith('event: JOB_CREATED\ndata: {"job_id":1}\n\n');
    expect(b.write).toHaveBeenCalledWith('event: JOB_CREATED\ndata: {"job_id":1}\n\n');
  });

  it("broadcasts only to clients in the target org", () => {
    const target = makeClient("org-a");
    const other = makeClient("org-b");
    const none = makeClient(null);
    broadcast({ type: "WELL_UPDATED", data: { well_id: 5 }, orgId: "org-a" });
    const payload = "event: WELL_UPDATED\ndata: {\"well_id\":5}\n\n";
    expect(target.write).toHaveBeenCalledWith(payload);
    expect(other.write).not.toHaveBeenCalledWith(payload);
    expect(other.write).not.toHaveBeenCalledWith(expect.stringContaining("WELL_UPDATED"));
    expect(none.write).not.toHaveBeenCalledWith(payload);
  });

  it("removes a client whose write throws during broadcast", () => {
    const good = makeClient();
    const bad = createRes();
    created.push(bad);
    addClient(bad, "user-2", null);
    bad.write = vi.fn(() => {
      throw new Error("closed");
    });
    broadcast({ type: "WELL_UPDATED", data: {} });
    expect(good.write).toHaveBeenCalled();
    expect(clientCount()).toBe(1);
  });

  it("refuses new clients beyond the capacity", () => {
    const max = 50;
    const many: Response[] = [];
    for (let i = 0; i < max; i++) {
      const res = createRes();
      created.push(res);
      addClient(res, `u${i}`, null);
    }
    const extra = createRes();
    created.push(extra);
    const ok = addClient(extra, "overflow", null);
    expect(ok).toBe(false);
    expect(extra.status).toHaveBeenCalledWith(429);
    expect(clientCount()).toBe(max);
  });
});