import { Response } from "express";

export interface SSEEvent {
  type: string;
  data: any;
}

const MAX_CLIENTS = 50;
const HEARTBEAT_INTERVAL = 30_000;

const clients = new Map<Response, { userId?: string; lastPing: number }>();
let heartbeatTimer: NodeJS.Timeout | null = null;

function startHeartbeat() {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    const now = Date.now();
    for (const [res, meta] of clients) {
      if (now - meta.lastPing > HEARTBEAT_INTERVAL * 2) {
        removeClient(res);
        continue;
      }
      try {
        res.write(": heartbeat\n\n");
        meta.lastPing = now;
      } catch {
        removeClient(res);
      }
    }
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (clients.size === 0 && heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

export function addClient(res: Response, userId?: string): boolean {
  if (clients.size >= MAX_CLIENTS) {
    res.status(429).json({ error: "เชื่อมต่อจำนวนสูงสุดแล้ว" });
    return false;
  }

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });

  res.write(": connected\n\n");

  clients.set(res, { userId, lastPing: Date.now() });

  res.on("close", () => {
    removeClient(res);
  });

  startHeartbeat();
  return true;
}

export function removeClient(res: Response) {
  clients.delete(res);
  stopHeartbeat();
}

export function broadcast(event: SSEEvent) {
  const payload = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
  for (const [res] of clients) {
    try {
      res.write(payload);
    } catch {
      removeClient(res);
    }
  }
}

export function clientCount(): number {
  return clients.size;
}
