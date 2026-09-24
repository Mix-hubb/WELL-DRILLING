import { supabase } from "../config/supabase";
import { logError } from "../middleware/observability";

export interface SSEEvent {
  type: string;
  data: any;
  orgId?: string | null;
}

function getChannel(orgId?: string | null) {
  if (!supabase) return null;
  const name = orgId ? `org:${orgId}` : "global";
  return supabase.channel(name);
}

export function broadcast(event: SSEEvent) {
  const ch = getChannel(event.orgId);
  if (!ch) return;
  ch.send({
    type: "broadcast",
    event: event.type,
    payload: event.data,
  }).catch((err) => {
    logError(err, undefined, { source: "broadcast", event: event.type, orgId: event.orgId ?? null });
  });
}
