import { supabase } from "../config/supabase";

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
  });
}

export function clientCount(): number {
  return 0;
}

export function addClient(): boolean {
  return true;
}

export function removeClient(): void {}
