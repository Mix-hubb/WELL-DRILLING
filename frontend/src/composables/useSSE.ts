import { ref, computed, onUnmounted } from "vue";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

type EventCallback = (data: any) => void;

const TOKEN_KEY = "welldrill-token";
const listeners = new Map<string, Set<EventCallback>>();

// orgConnected defaults to true so a user with no org yet doesn't permanently
// block `connected` (which is an AND of both channels' health).
const orgConnected = ref(true);
const globalConnected = ref(false);
const connected = computed(() => orgConnected.value && globalConnected.value);

let orgChannel: RealtimeChannel | null = null;
let globalChannel: RealtimeChannel | null = null;
let reconnectAttempt = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

const RECONNECT_DELAYS_MS = [3000, 6000, 12000, 30000];

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

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

// Tears down the live channels and resets connection status, but deliberately
// leaves `listeners` untouched — components that stay mounted across a
// disconnect (e.g. logout -> login) must keep receiving events once the
// channels reopen, instead of silently going deaf until they remount.
function closeChannels() {
  clearReconnectTimer();
  if (orgChannel) {
    supabase?.removeChannel(orgChannel);
    orgChannel = null;
  }
  if (globalChannel) {
    supabase?.removeChannel(globalChannel);
    globalChannel = null;
  }
  orgConnected.value = true;
  globalConnected.value = false;
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  closeChannels();
  const delay = RECONNECT_DELAYS_MS[Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    reconnectAttempt++;
    connectSSE();
  }, delay);
}

function handleStatus(kind: "org" | "global", status: string) {
  const flag = kind === "org" ? orgConnected : globalConnected;
  if (status === "SUBSCRIBED") {
    flag.value = true;
    reconnectAttempt = 0;
  } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
    flag.value = false;
    scheduleReconnect();
  }
}

export function connectSSE() {
  if (!supabase) return;
  if (orgChannel || globalChannel) return;

  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;

  const orgId = getOrgId();

  if (orgId) {
    orgConnected.value = false;
    orgChannel = supabase
      .channel(`org:${orgId}`)
      .on("broadcast", { event: "*" }, ({ event, payload }) => {
        dispatchEvent(event, payload);
      })
      .subscribe((status) => handleStatus("org", status));
  } else {
    orgConnected.value = true;
  }

  globalChannel = supabase
    .channel("global")
    .on("broadcast", { event: "*" }, ({ event, payload }) => {
      dispatchEvent(event, payload);
    })
    .subscribe((status) => handleStatus("global", status));
}

// Called on tab visibility / network-online recovery: the underlying
// websocket can die silently while a tab is backgrounded (no CHANNEL_ERROR/
// CLOSED ever fires), so this force-closes and reopens whenever we're not
// fully connected, rather than relying on connectSSE()'s dedup guard alone.
export function ensureConnected() {
  if (!supabase) return;
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;
  if (connected.value) return;
  closeChannels();
  reconnectAttempt = 0;
  connectSSE();
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
  closeChannels();
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
