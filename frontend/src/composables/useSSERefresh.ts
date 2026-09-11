import { onMounted } from "vue";
import { useSSE } from "./useSSE";
import { debounce } from "@/utils/debounce";

export type SSESubscription =
  | string
  | { event: string; filter?: (data: any) => boolean };

export function useSSERefresh(
  refresh: () => void | Promise<void>,
  subscriptions: SSESubscription[],
  delay = 80,
) {
  const { on } = useSSE();
  const debounced = debounce(refresh, delay);

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
  });
}
