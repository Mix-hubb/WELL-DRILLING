import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { useSSE, disconnectSSE } from "./useSSE";

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  listeners = new Map<string, ((e: { data: string }) => void)[]>();
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, cb: (e: { data: string }) => void) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type)!.push(cb);
  }

  emit(type: string, data: unknown) {
    for (const cb of this.listeners.get(type) || []) {
      cb({ data: JSON.stringify(data) });
    }
  }
}

const Host = defineComponent({
  setup() {
    return useSSE();
  },
  template: `<div />`,
});

const BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:4001/api").replace(/\/api\/?$/, "");
const lastInstance = () => MockEventSource.instances[MockEventSource.instances.length - 1];

beforeEach(() => {
  disconnectSSE();
  localStorage.clear();
  MockEventSource.instances = [];
  vi.stubGlobal("EventSource", MockEventSource);
});

afterEach(() => {
  disconnectSSE();
  vi.unstubAllGlobals();
});

describe("useSSE", () => {
  it("does not connect without a token", () => {
    const wrapper = mount(Host);
    wrapper.vm.connect();
    expect(MockEventSource.instances).toHaveLength(0);
    expect(wrapper.vm.connected).toBe(false);
  });

  it("connects using the token and flips connected on open", async () => {
    localStorage.setItem("welldrill-token", "tok-abc");
    const wrapper = mount(Host);
    wrapper.vm.connect();

    expect(MockEventSource.instances).toHaveLength(1);
    expect(lastInstance().url).toBe(`${BASE_URL}/api/events?token=tok-abc`);
    expect(wrapper.vm.connected).toBe(false);

    lastInstance().onopen?.();
    await Promise.resolve();
    expect(wrapper.vm.connected).toBe(true);
  });

  it("does not create a second connection when already connected", () => {
    localStorage.setItem("welldrill-token", "tok");
    const wrapper = mount(Host);
    wrapper.vm.connect();
    wrapper.vm.connect();
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it("parses event payloads and passes them to listeners", () => {
    localStorage.setItem("welldrill-token", "tok");
    const wrapper = mount(Host);
    const cb = vi.fn();
    wrapper.vm.on("JOB_CREATED", cb);
    wrapper.vm.connect();

    lastInstance().emit("JOB_CREATED", { job_id: 7 });
    expect(cb).toHaveBeenCalledWith({ job_id: 7 });

    wrapper.vm.off("JOB_CREATED", cb);
    lastInstance().emit("JOB_CREATED", { job_id: 8 });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("delivers payment slip events", () => {
    localStorage.setItem("welldrill-token", "tok");
    const wrapper = mount(Host);
    const cb = vi.fn();
    wrapper.vm.on("PAYMENT_SLIP_RECEIVED", cb);
    wrapper.vm.connect();

    lastInstance().emit("PAYMENT_SLIP_RECEIVED", { repair_id: 12 });

    expect(cb).toHaveBeenCalledWith({ repair_id: 12 });
  });

  it("ignores malformed event payloads", () => {
    localStorage.setItem("welldrill-token", "tok");
    const wrapper = mount(Host);
    const cb = vi.fn();
    wrapper.vm.on("JOB_CREATED", cb);
    wrapper.vm.connect();

    for (const cb2 of lastInstance().listeners.get("JOB_CREATED") || []) {
      cb2({ data: "{broken json" });
    }
    expect(cb).not.toHaveBeenCalled();
  });

  it("marks the connection dead on error and allows reconnecting", async () => {
    localStorage.setItem("welldrill-token", "tok");
    const wrapper = mount(Host);
    wrapper.vm.connect();
    const first = lastInstance();
    first.onopen?.();
    await Promise.resolve();
    first.onerror?.();
    expect(wrapper.vm.connected).toBe(false);

    wrapper.vm.connect();
    expect(MockEventSource.instances).toHaveLength(2);
    expect(lastInstance()).not.toBe(first);
  });

  it("disconnect closes the stream and clears listeners", () => {
    localStorage.setItem("welldrill-token", "tok");
    const wrapper = mount(Host);
    wrapper.vm.on("JOB_CREATED", () => {});
    wrapper.vm.connect();
    const instance = lastInstance();

    wrapper.vm.disconnect();
    expect(instance.close).toHaveBeenCalled();
    expect(wrapper.vm.connected).toBe(false);

    instance.emit("JOB_CREATED", {});
    expect(instance.close).toHaveBeenCalledTimes(1);
  });

  it("closes the connection on unmount when no listeners remain", () => {
    localStorage.setItem("welldrill-token", "tok");
    const wrapper = mount(Host);
    wrapper.vm.connect();
    const instance = lastInstance();
    wrapper.unmount();
    expect(instance.close).toHaveBeenCalled();
  });

  it("shares one connection across multiple composable instances", () => {
    localStorage.setItem("welldrill-token", "tok");
    const wrapper1 = mount(Host);
    const wrapper2 = mount(Host);
    const cb1 = vi.fn();
    const cb2 = vi.fn();

    wrapper1.vm.connect();
    wrapper1.vm.on("JOB_CREATED", cb1);
    wrapper2.vm.on("JOB_CREATED", cb2);

    expect(MockEventSource.instances).toHaveLength(1);

    lastInstance().emit("JOB_CREATED", { job_id: 1 });
    expect(cb1).toHaveBeenCalledWith({ job_id: 1 });
    expect(cb2).toHaveBeenCalledWith({ job_id: 1 });

    wrapper1.unmount();
    expect(lastInstance().close).not.toHaveBeenCalled();

    wrapper2.unmount();
    expect(lastInstance().close).toHaveBeenCalled();
  });
});