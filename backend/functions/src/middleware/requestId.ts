import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "crypto";
import pino from "pino";

const baseLogger = pino({ level: process.env.LOG_LEVEL || "info" });

export function requestIdAndLogger() {
  return function (req: Request, _res: Response, next: NextFunction) {
    const headerId = req.header("X-Request-Id");
    const requestId = headerId && headerId.trim().length > 0 ? headerId : randomUUID();
    (req as any).requestId = requestId;
    (req as any).logger = baseLogger.child({ requestId, path: req.originalUrl, method: req.method });
    next();
  };
}

export type RequestWithLogger = Request & { requestId?: string; logger?: pino.Logger };

