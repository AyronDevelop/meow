import * as functions from "firebase-functions";
import admin from "firebase-admin";
import { Storage } from "@google-cloud/storage";
import { LlmClient } from "./llm.js";
import { parseGcsUri } from "./util.js";

function ensureAdmin() {
  try {
    if (!admin.apps.length) admin.initializeApp();
  } catch {}
}

ensureAdmin();
const storage = new Storage();

export const jobsWorker = functions
  .region(process.env.REGION || "us-central1")
  .runWith({ memory: "1GB", timeoutSeconds: 540, minInstances: 0, secrets: ["OPENAI_API_KEY"] })
  .pubsub.topic(process.env.JOBS_TOPIC || "jobs-queue").onPublish(async (message) => {
    const data = message.json as { jobId: string; uploadId: string; gcsPath: string; options?: any };
    const db = admin.firestore();
    const jobRef = db.collection("jobs").doc(data.jobId);
    try {
      await jobRef.set({ status: "processing", updatedAt: Date.now() }, { merge: true });

      const { bucket, object } = parseGcsUri(data.gcsPath);
      let pdfBuffer: Buffer | null = null;
      try {
        const downloaded = await storage.bucket(bucket).file(object).download();
        pdfBuffer = downloaded[0] as Buffer;
      } catch {
        pdfBuffer = null;
      }

      let text = "";
      try {
        if (pdfBuffer && pdfBuffer.length > 0) {
          const pdfParse = (await import("pdf-parse")).default as (input: Buffer) => Promise<{ text: string }>;
          const parsed = await pdfParse(pdfBuffer);
          text = parsed.text || "";
        }
      } catch {
        text = ""; // fallback ниже
      }

      const pages = (text && text.trim().length > 0 ? text : "Uploaded PDF")
        .split(/\n\s*\n/g)
        .slice(0, 50)
        .map((t: string, i: number) => ({ index: i + 1, text: t.slice(0, 5000) }));
      const images: Array<{ page: number; url: string }> = [];

      const openaiDisabled = String(process.env.OPENAI_DISABLED || "false").toLowerCase() === "true";
      let slides: any;
      if (openaiDisabled) {
        // Stub result: превращаем первые 5 секций текста в 5 слайдов
        const take = pages.slice(0, 5);
        slides = {
          title: "Generated Deck (stub)",
          theme: data.options?.theme || "DEFAULT",
          slides: take.map((p) => ({
            title: `Slide ${p.index}`,
            bullets: p.text.split(/\n|\.\s+/).filter(Boolean).slice(0, 5),
            layout: "TITLE_AND_BODY",
          })),
        };
      } else {
        const llm = new LlmClient(process.env.OPENAI_API_KEY as string);
        slides = await llm.generateSlides({ pages, images, maxSlides: data.options?.maxSlides, language: data.options?.language, theme: data.options?.theme });
      }

      const resultPath = `jobs/${data.jobId}/result.json`;
      const jobsBucket = process.env.GCS_BUCKET_JOBS || "";
      if (!jobsBucket) throw new Error("GCS_BUCKET_JOBS not configured");
      await storage.bucket(jobsBucket).file(resultPath).save(Buffer.from(JSON.stringify(slides)), { contentType: "application/json" });

      await jobRef.set({ status: "done", updatedAt: Date.now() }, { merge: true });
    } catch (e: any) {
      const messageText = e?.message || String(e);
      await jobRef.set({ status: "error", error: { code: "WORKER_ERROR", message: messageText }, updatedAt: Date.now() }, { merge: true });
      console.error("jobsWorker error", { jobId: data.jobId, error: messageText });
    }
  });


