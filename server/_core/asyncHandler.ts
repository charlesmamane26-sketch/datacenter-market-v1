import type { NextFunction, Request, RequestHandler, Response } from "express";

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

/**
 * Express 4 does not forward rejected route promises to error middleware.
 * Keep async route handlers explicit and make every rejection reach `next`.
 */
export function asyncHandler(handler: AsyncRequestHandler): RequestHandler {
  return (req, res, next) =>
    Promise.resolve(handler(req, res, next)).catch(next);
}
