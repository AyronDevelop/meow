import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

function timingSafeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a || "");
  const bb = Buffer.from(b || "");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function hmacAuth(secretProvider: (keyId?: string) => string) {
  return function (req: Request, res: Response, next: NextFunction) {
    try {
      const tsHeader = req.header("X-Timestamp");
      const signature = req.header("X-Signature") || "";
      const keyId = req.header("X-Key-Id") || undefined;
      const nonce = req.header("X-Nonce");
      const now = Date.now();
      const ts = Number(tsHeader || 0);
      if (!ts || Math.abs(now - ts) > 5 * 60 * 1000) {
        return res.status(401).json({ error: { code: "AUTH_FAILED", message: "timestamp invalid" } });
      }

      const method = req.method.toUpperCase();
      const hasBody = method !== "GET" && method !== "HEAD";
      const rawBody = hasBody
        ? ( (req as any).rawBody ? String((req as any).rawBody) : JSON.stringify(req.body ?? "") )
        : "";
      const path = (req as any).originalUrl || req.path;
      const payload = `${req.method}\n${path}\n${ts}\n${rawBody}` + (nonce ? `\n${nonce}` : "");

      const currentSecret = secretProvider(keyId);
      const expected = crypto.createHmac("sha256", currentSecret).update(payload).digest("base64");

      let ok = timingSafeEqual(signature, expected);
      const prev = process.env.ADDON_SHARED_SECRET_PREV;
      if (!ok && prev) {
        const expectedPrev = crypto.createHmac("sha256", prev).update(payload).digest("base64");
        ok = timingSafeEqual(signature, expectedPrev);
      }

      if (!ok) return res.status(401).json({ error: { code: "AUTH_FAILED", message: "signature mismatch" } });

      next();
    } catch (e) {
      return res.status(401).json({ error: { code: "AUTH_FAILED", message: "verification error" } });
    }
  };
}

