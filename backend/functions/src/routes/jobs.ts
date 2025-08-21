import { Router } from "express";
import { z } from "zod";
import admin from "firebase-admin";
import { PubSub } from "@google-cloud/pubsub";
import { Storage } from "@google-cloud/storage";
import { config } from "../config.js";

const createSchema = z.object({
  uploadId: z.string().min(1),
  pdfName: z.string().min(1),
  options: z
    .object({
      maxSlides: z.number().int().positive().max(200).optional(),
      language: z.string().optional(),
      theme: z.enum(["DEFAULT", "LIGHT", "DARK"]).optional(),
    })
    .optional(),
});

function ensureAdminInit() {
  try {
    if (!admin.apps.length) {
      admin.initializeApp();
    }
  } catch {
    // ignore re-init errors
  }
}

export function jobsRouter() {
  ensureAdminInit();
  const r = Router();
  const db = admin.firestore();
  const pubsub = new PubSub();
  const storage = new Storage();

  r.post("/", async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: { code: "BAD_REQUEST", message: parsed.error.message } });
    }

    const { uploadId, pdfName, options } = parsed.data;

    const jobId = `job_${Math.random().toString(36).slice(2, 10)}${Date.now()}`;
    const gcsPath = `gs://${config.buckets.uploads}/uploads/${uploadId}/source.pdf`;

    const jobDoc = {
      status: "queued" as const,
      uploadId,
      pdfName,
      gcsPath,
      options: options || {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
      attempts: 0,
    };

    await db.collection("jobs").doc(jobId).set(jobDoc);

    const topicName = process.env.JOBS_TOPIC || "jobs-queue";
    await pubsub.topic(topicName).publishMessage({ json: { jobId, uploadId, gcsPath, options: options || {} } });

    return res.json({ jobId });
  });

  r.get("/:jobId", async (req, res) => {
    const { jobId } = req.params;
    if (!jobId) return res.status(400).json({ error: { code: "BAD_REQUEST", message: "jobId required" } });

    const snap = await admin.firestore().collection("jobs").doc(jobId).get();
    if (!snap.exists) return res.status(404).json({ error: { code: "NOT_FOUND", message: "job not found" } });

    const data = snap.data() as any;
    const response: any = {
      status: data.status,
      metrics: data.metrics || undefined,
      error: data.error || undefined,
    };

    if (data.status === "done") {
      const objectPath = `jobs/${jobId}/result.json`;
      const [signed] = await storage
        .bucket(config.buckets.jobs)
        .file(objectPath)
        .getSignedUrl({
          version: "v4",
          action: "read",
          expires: Date.now() + config.limits.signedUrlTtlSeconds * 1000,
        });
      response.result = { resultJsonUrl: signed };
    }

    return res.json(response);
  });

  return r;
}


