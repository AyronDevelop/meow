import type { Request, Response, NextFunction } from "express";

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function errorHandler() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return function (err: any, req: Request, res: Response, _next: NextFunction) {
    const requestId = (req as any).requestId;
    const logger = (req as any).logger || console;

    if (err instanceof ApiError) {
      logger.error({ err, requestId }, "ApiError");
      return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details }, requestId });
    }

    logger.error({ err, requestId }, "Unhandled error");
    return res.status(500).json({ error: { code: "INTERNAL", message: "Internal server error" }, requestId });
  };
}


