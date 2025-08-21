import express from "express";
import { z } from "zod";
import { Storage } from "@google-cloud/storage";
import fs from "node:fs";
import { spawn } from "node:child_process";

const app = express();
app.use(express.json({ limit: "2mb" }));
const storage = new Storage();

const reqSchema = z.object({
  gcsPath: z.string().startsWith("gs://"),
  dpi: z.number().int().min(72).max(300).optional(),
  maxPages: z.number().int().min(1).max(500).optional(),
  jobId: z.string().optional(),
});

function parseGcs(uri: string) {
  const u = uri.slice(5);
  const i = u.indexOf("/");
  if (i < 0) throw new Error("bad gcs uri");
  return { bucket: u.slice(0, i), object: u.slice(i + 1) };
}

app.post("/render", async (req, res) => {
  const parsed = reqSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const { gcsPath, dpi = 180, maxPages = 150, jobId } = parsed.data;
  try {
    const { bucket, object } = parseGcs(gcsPath);

    // Write PDF to tmp
    const inputPath = `/tmp/input.pdf`;
    await storage.bucket(bucket).file(object).download({ destination: inputPath });

    // Render pages via pdftocairo (PNG)
    const outPrefix = `/tmp/page`;
    await new Promise<void>((resolve, reject) => {
      const p = spawn("pdftocairo", ["-png", `-r`, String(dpi), inputPath, outPrefix]);
      p.on("error", reject);
      p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`pdftocairo exit ${code}`))));
    });

    // Upload pages back to GCS jobs bucket under jobs/{jobId}/pages/{n}.png
    const targetBucketName = process.env.GCS_BUCKET_JOBS || bucket;
    const targetBucket = storage.bucket(targetBucketName);
    const pages = [] as Array<{ index: number; gcsObject: string }>;
    for (let i = 1; i <= maxPages; i++) {
      const local = `/tmp/page-${i}.png`;
      if (!fs.existsSync(local)) break;
      const destObject = jobId ? `jobs/${jobId}/pages/${i}.png` : `jobs/unknown/pages/${i}.png`;
      await targetBucket.upload(local, { destination: destObject, contentType: "image/png" });
      pages.push({ index: i, gcsObject: destObject });
    }
    return res.json({ pages });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "render failed" });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`renderer listening on ${port}`));


