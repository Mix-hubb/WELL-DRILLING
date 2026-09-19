import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";

export function requestContext(req: Request, res: Response, next: NextFunction) {
  const requestId = req.header("x-request-id") || randomUUID();
  const startedAt = Date.now();

  res.setHeader("X-Request-Id", requestId);
  res.on("finish", () => {
    console.log(JSON.stringify({
      event: "http_request",
      request_id: requestId,
      method: req.method,
      path: req.originalUrl.split("?")[0],
      status: res.statusCode,
      duration_ms: Date.now() - startedAt,
      user_id: req.user?.userId || null,
      org_id: req.user?.orgId || null,
    }));
  });

  next();
}

export function logError(error: unknown, requestId?: string) {
  const err = error instanceof Error ? error : new Error(String(error));
  console.error(JSON.stringify({
    event: "application_error",
    request_id: requestId || null,
    error: err.message,
    stack: err.stack,
  }));
}
