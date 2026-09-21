import { ref, onUnmounted } from "vue";
import { supabase } from "@/lib/supabase";

type EventCallback = (data: any) => void;

const TOKEN_KEY = "welldrill-token";
const listeners = new Map<string, Set<EventCallback>>();
const connected = ref(false);

let orgChannel: ReturnType<typeof supabase.channel> | null = null;
let globalChannel: ReturnType<typeof supabase.channel> | null = null;

function getOrgId(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.orgId || null;
  } catch {
    return null;
  }
}

function dispatchEvent(eventType: string, payload: any) {
  const cbs = listeners.get(eventType);
  if (cbs) cbs.forEach((cb) => cb(payload));
}

function isOrgEvent(eventType: string): boolean {
  return !eventType.startsWith("PUMP_CATALOG_");
}

export function connectSSE() {
  if (!supabase) return;
  if (orgChannel || globalChannel) return;

  const orgId = getOrgId();

  if (orgId) {
    orgChannel = supabase
      .channel(`org:${orgId}`)
      .on("broadcast", { event: "*" }, ({ event, payload }) => {
        dispatchEvent(event, payload);
      })
      .subscribe((status) => {
        connected.value = status === "SUBSCRIBED";
      });
  }

  globalChannel = supabase
    .channel("global")
    .on("broadcast", { event: "*" }, ({ event, payload }) => {
      dispatchEvent(event, payload);
    })
    .subscribe();
}

function on(event: string, callback: EventCallback) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(callback);
}

function off(event: string, callback: EventCallback) {
  listeners.get(event)?.delete(callback);
}

function hasListeners(): boolean {
  for (const set of listeners.values()) {
    if (set.size > 0) return true;
  }
  return false;
}

export function disconnectSSE() {
  if (orgChannel) {
    supabase?.removeChannel(orgChannel);
    orgChannel = null;
  }
  if (globalChannel) {
    supabase?.removeChannel(globalChannel);
    globalChannel = null;
  }
  connected.value = false;
  listeners.clear();
}

export { connected };

export function useSSE() {
  const tracked: Array<[string, EventCallback]> = [];

  function trackOn(event: string, callback: EventCallback) {
    on(event, callback);
    tracked.push([event, callback]);
  }

  onUnmounted(() => {
    for (const [event, cb] of tracked) off(event, cb);
    tracked.length = 0;
    if (!hasListeners()) disconnectSSE();
  });

  return {
    connected,
    connect: connectSSE,
    on: trackOn,
    off,
    disconnect: disconnectSSE,
  };
}
