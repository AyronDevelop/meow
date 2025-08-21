import { Router } from "express";
import { z } from "zod";
import { Storage } from "@google-cloud/storage";
import { config } from "../config.js";

const requestSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.literal("application/pdf"),
  contentLength: z.number().int().positive(),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
});

export function uploadsRouter() {
  const r = Router();
  const storage = new Storage();

  r.post("/signed-url", async (req, res) => {
    const parsed = requestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: "BAD_REQUEST", message: parsed.error.message } });
    }
    const { fileName, contentType, contentLength } = parsed.data;

    if (contentLength > config.limits.maxPdfBytes) {
      return res.status(400).json({ error: { code: "PDF_TOO_LARGE", message: "File exceeds max size" } });
    }

    const uploadId = `upl_${Math.random().toString(36).slice(2, 10)}${Date.now()}`;
    const objectPath = `uploads/${uploadId}/source.pdf`;

    const [url] = await storage
      .bucket(config.buckets.uploads)
      .file(objectPath)
      .getSignedUrl({
        version: "v4",
        action: "write",
        expires: Date.now() + config.limits.signedUrlTtlSeconds * 1000,
        contentType,
      });

    return res.json({
      uploadId,
      uploadUrl: url,
      headers: { "Content-Type": contentType, "x-goog-content-sha256": "UNSIGNED-PAYLOAD" },
      expiresAt: new Date(Date.now() + config.limits.signedUrlTtlSeconds * 1000).toISOString(),
      limits: { maxBytes: config.limits.maxPdfBytes, maxPages: config.limits.maxPages },
    });
  });

  return r;
}

