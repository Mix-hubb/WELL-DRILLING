import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { useSSE, disconnectSSE } from "./useSSE";

function createMockChannel(name: string) {
  const broadcastHandlers: Array<{
    filter: { event: string };
    callback: (payload: any) => void;
  }> = [];
  let subscribeCb: ((status: string) => void) | null = null;

  return {
    name,
    _broadcastHandlers: broadcastHandlers,
    on(
      type: string,
      filter: { event: string },
      callback: (payload: any) => void,
    ) {
      if (type === "broadcast") {
        broadcastHandlers.push({ filter, callback });
      }
      return this;
    },
    subscribe(cb?: (status: string) => void) {
      subscribeCb = cb || null;
      return this;
    },
    _fireBroadcast(event: string, payload: any) {
      for (const h of broadcastHandlers) {
        if (h.filter.event === "*" || h.filter.event === event) {
          h.callback({ event, payload });
        }
      }
    },
    _fireSubscribe(status: string) {
      subscribeCb?.(status);
    },
    unsubscribe: vi.fn(),
  };
}

const mockChannels: ReturnType<typeof createMockChannel>[] = [];

vi.mock("@/lib/supabase", () => {
  const channelFn = vi.fn((_name: string) => {
    const ch = createMockChannel(_name);
    mockChannels.push(ch);
    return ch;
  });

  return {
    supabase: {
      channel: channelFn,
      removeChannel: vi.fn((_ch: any) => {}),
    },
  };
});

const Host = defineComponent({
  setup() {
    return useSSE();
  },
  template: `<div />`,
});

beforeEach(() => {
  disconnectSSE();
  localStorage.clear();
  mockChannels.length = 0;
});

afterEach(() => {
  disconnectSSE();
});

describe("useSSE", () => {
  it("does not connect without a token", () => {
    const wrapper = mount(Host);
    wrapper.vm.connect();
    expect(mockChannels).toHaveLength(0);
    expect(wrapper.vm.connected).toBe(false);
  });

  it("creates org and global channels and flips connected on SUBSCRIBED", async () => {
    localStorage.setItem("welldrill-token", "tok.eyJvcmdJZCI6Im9yZy0xIn0.");
    const wrapper = mount(Host);
    wrapper.vm.connect();

    expect(mockChannels).toHaveLength(2);
    expect(mockChannels[0].name).toBe("org:org-1");
    expect(mockChannels[1].name).toBe("global");
    expect(wrapper.vm.connected).toBe(false);

    mockChannels[0]._fireSubscribe("SUBSCRIBED");
    await Promise.resolve();
    expect(wrapper.vm.connected).toBe(true);
  });

  it("does not create a second connection when already connected", () => {
    localStorage.setItem("welldrill-token", "tok.eyJvcmdJZCI6Im9yZy0xIn0.");
    const wrapper = mount(Host);
    wrapper.vm.connect();
    wrapper.vm.connect();
    expect(mockChannels).toHaveLength(2);
  });

  it("parses event payloads and passes them to listeners", () => {
    localStorage.setItem("welldrill-token", "tok.eyJvcmdJZCI6Im9yZy0xIn0.");
    const wrapper = mount(Host);
    const cb = vi.fn();
    wrapper.vm.on("JOB_CREATED", cb);
    wrapper.vm.connect();

    mockChannels[0]._fireBroadcast("JOB_CREATED", { job_id: 7 });
    expect(cb).toHaveBeenCalledWith({ job_id: 7 });

    wrapper.vm.off("JOB_CREATED", cb);
    mockChannels[0]._fireBroadcast("JOB_CREATED", { job_id: 8 });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("delivers payment slip events", () => {
    localStorage.setItem("welldrill-token", "tok.eyJvcmdJZCI6Im9yZy0xIn0.");
    const wrapper = mount(Host);
    const cb = vi.fn();
    wrapper.vm.on("PAYMENT_SLIP_RECEIVED", cb);
    wrapper.vm.connect();

    mockChannels[0]._fireBroadcast("PAYMENT_SLIP_RECEIVED", { repair_id: 12 });
    expect(cb).toHaveBeenCalledWith({ repair_id: 12 });
  });

  it("only listens for wildcard events", () => {
    localStorage.setItem("welldrill-token", "tok.eyJvcmdJZCI6Im9yZy0xIn0.");
    const wrapper = mount(Host);
    wrapper.vm.connect();

    expect(mockChannels[0]._broadcastHandlers).toHaveLength(1);
    expect(mockChannels[0]._broadcastHandlers[0].filter.event).toBe("*");
  });

  it("disconnect removes channels and clears listeners", () => {
    localStorage.setItem("welldrill-token", "tok.eyJvcmdJZCI6Im9yZy0xIn0.");
    const wrapper = mount(Host);
    wrapper.vm.on("JOB_CREATED", () => {});
    wrapper.vm.connect();

    wrapper.vm.disconnect();
    expect(wrapper.vm.connected).toBe(false);
  });

  it("closes the connection on unmount when no listeners remain", () => {
    localStorage.setItem("welldrill-token", "tok.eyJvcmdJZCI6Im9yZy0xIn0.");
    const wrapper = mount(Host);
    wrapper.vm.connect();
    wrapper.unmount();
  });

  it("shares one connection across multiple composable instances", () => {
    localStorage.setItem("welldrill-token", "tok.eyJvcmdJZCI6Im9yZy0xIn0.");
    const wrapper1 = mount(Host);
    const wrapper2 = mount(Host);
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    wrapper1.vm.connect();
    wrapper1.vm.on("JOB_CREATED", cb1);
    wrapper2.vm.on("JOB_CREATED", cb2);

    expect(mockChannels).toHaveLength(2);

    mockChannels[0]._fireBroadcast("JOB_CREATED", { job_id: 1 });
    expect(cb1).toHaveBeenCalledWith({ job_id: 1 });
    expect(cb2).toHaveBeenCalledWith({ job_id: 1 });

    wrapper1.unmount();
    wrapper2.unmount();
  });

  it("global channel delivers pump catalog events", () => {
    localStorage.setItem("welldrill-token", "tok.eyJvcmdJZCI6Im9yZy0xIn0.");
    const wrapper = mount(Host);
    const cb = vi.fn();
    wrapper.vm.on("PUMP_CATALOG_UPDATED", cb);
    wrapper.vm.connect();

    mockChannels[1]._fireBroadcast("PUMP_CATALOG_UPDATED", { id: 5 });
    expect(cb).toHaveBeenCalledWith({ id: 5 });
  });
});
