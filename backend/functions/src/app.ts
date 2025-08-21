import express, { json, type Request, type Response } from "express";
import { hmacAuth } from "./middleware/hmac.js";
import { requireEnv } from "./config.js";
import { uploadsRouter } from "./routes/uploads.js";
import { jobsRouter } from "./routes/jobs.js";
import { requestIdAndLogger } from "./middleware/requestId.js";
import { antiReplayNonce } from "./middleware/nonce.js";
import { errorHandler } from "./errors.js";

export function createApp() {
  const app = express();

  app.use(json({ limit: "5mb" }));
  app.use(requestIdAndLogger());
  app.get("/public/health", (_req: Request, res: Response) => res.json({ ok: true }));
  app.use(antiReplayNonce(300, process.env.ANTI_REPLAY_ENABLED !== "false"));

  app.use(hmacAuth((keyId?: string) => {
    return requireEnv("ADDON_SHARED_SECRET");
  }));

  app.get("/health", (_req: Request, res: Response) => res.json({ ok: true }));

  app.use("/v1/uploads", uploadsRouter());
  app.use("/v1/jobs", jobsRouter());

  app.use(errorHandler());

  return app;
}

