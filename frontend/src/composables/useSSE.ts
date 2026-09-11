import { ref, onUnmounted } from "vue";

type EventCallback = (data: any) => void;

const BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:4001/api").replace(/\/api\/?$/, "");
const TOKEN_KEY = "welldrill-token";

let eventSource: EventSource | null = null;
const listeners = new Map<string, Set<EventCallback>>();
const connected = ref(false);

function hasListeners(): boolean {
  for (const set of listeners.values()) {
    if (set.size > 0) return true;
  }
  return false;
}

export function connectSSE() {
  if (eventSource) return;

  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return;

  const url = `${BASE_URL}/api/events?token=${encodeURIComponent(token)}`;
  eventSource = new EventSource(url);

  eventSource.onopen = () => {
    connected.value = true;
  };

  eventSource.onerror = () => {
    connected.value = false;
    eventSource?.close();
    eventSource = null;
  };

  const customEvents = [
    "JOB_CREATED",
    "JOB_UPDATED",
    "JOB_DELETED",
    "JOB_STATUS_CHANGED",
    "DRILLING_REQUEST_CREATED",
    "DRILLING_REQUEST_UPDATED",
    "DRILLING_REQUEST_CHANGED",
    "DRILLING_REQUEST_DELETED",
    "REPAIR_REQUEST_CREATED",
    "REPAIR_REQUEST_UPDATED",
    "REPAIR_REQUEST_CHANGED",
    "REPAIR_REQUEST_DELETED",
    "REPAIR_RECORD_ADDED",
    "WELL_CREATED",
    "WELL_UPDATED",
    "CUSTOMER_CREATED",
    "CUSTOMER_UPDATED",
    "CUSTOMER_DELETED",
    "QUOTATION_CREATED",
    "QUOTATION_CHANGED",
    "QUOTATION_DELETED",
    "REPAIR_RECORD_DELETED",
  ];
  for (const eventType of customEvents) {
    eventSource.addEventListener(eventType, ((e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        const cbs = listeners.get(eventType);
        if (cbs) cbs.forEach((cb) => cb(data));
      } catch { /* ignore parse error */ }
    }) as EventListener);
  }
}

function on(event: string, callback: EventCallback) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(callback);
}

function off(event: string, callback: EventCallback) {
  listeners.get(event)?.delete(callback);
}

export function disconnectSSE() {
  eventSource?.close();
  eventSource = null;
  connected.value = false;
  listeners.clear();
}

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
