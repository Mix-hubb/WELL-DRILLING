import { onMounted, onUnmounted, watch } from "vue";
import { useSSE, connected } from "./useSSE";
import { debounce } from "@/utils/debounce";

export type SSESubscription =
  | string
  | { event: string; filter?: (data: any) => boolean };

const POLL_INTERVAL = 10_000;

export function useSSERefresh(
  refresh: () => void | Promise<void>,
  subscriptions: SSESubscription[],
  delay = 80,
) {
  const { on } = useSSE();
  const debounced = debounce(refresh, delay);
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(() => {
      debounced();
    }, POLL_INTERVAL);
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  onMounted(async () => {
    await refresh();
    for (const sub of subscriptions) {
      if (typeof sub === "string") {
        on(sub, debounced);
        continue;
      }
      on(sub.event, (data) => {
        if (!sub.filter || sub.filter(data)) debounced();
      });
    }

    if (!connected.value) startPolling();

    watch(connected, (isConnected) => {
      if (isConnected) {
        stopPolling();
      } else {
        startPolling();
      }
    });
  });

  onUnmounted(() => {
    stopPolling();
  });
}
