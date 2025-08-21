export type ServiceConfig = {
  region: string;
  projectId: string;
  buckets: {
    uploads: string;
    jobs: string;
  };
  limits: {
    maxPdfBytes: number;
    maxPages: number;
    signedUrlTtlSeconds: number;
  };
};

export const config: ServiceConfig = {
  region: process.env.REGION || "us-central1",
  projectId: process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT || "",
  buckets: {
    uploads:
      process.env.GCS_BUCKET_UPLOADS ||
      ((process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT) ? `${process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT}-slides-uploads` : ""),
    jobs:
      process.env.GCS_BUCKET_JOBS ||
      ((process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT) ? `${process.env.FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT}-slides-jobs` : ""),
  },
  limits: {
    maxPdfBytes: Number(process.env.PDF_MAX_BYTES || 31457280),
    maxPages: Number(process.env.PDF_MAX_PAGES || 150),
    signedUrlTtlSeconds: Number(process.env.SIGNED_URL_TTL_SECONDS || 7200),
  },
};

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

