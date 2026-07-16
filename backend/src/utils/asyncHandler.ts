import { Request, Response, NextFunction, RequestHandler } from "express";

// Express 4 does not forward rejected promises from async route handlers
// to the error middleware automatically — this wraps a handler so any
// thrown/rejected error is passed to next(err).
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
