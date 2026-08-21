import { ref, onUnmounted } from "vue";

type EventCallback = (data: any) => void;

const BASE_URL = (import.meta.env.VITE_API_URL || "http://localhost:4001/api").replace(/\/api\/?$/, "");
const TOKEN_KEY = "welldrill-token";

export function useSSE() {
  const connected = ref(false);
  let eventSource: EventSource | null = null;
  const listeners = new Map<string, Set<EventCallback>>();

  function connect() {
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
      eventSource = null;
    };

    const customEvents = [
      "JOB_CREATED",
      "JOB_STATUS_CHANGED",
      "DRILLING_REQUEST_CHANGED",
      "REPAIR_REQUEST_CHANGED",
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

  function disconnect() {
    eventSource?.close();
    eventSource = null;
    connected.value = false;
    listeners.clear();
  }

  onUnmounted(() => {
    disconnect();
  });

  return { connected, connect, on, off, disconnect };
}
