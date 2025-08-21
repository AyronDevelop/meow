import { z } from "zod";

export const SignedUrlResponseSchema = z.object({
  uploadId: z.string().min(1),
  uploadUrl: z.string().url(),
  headers: z.record(z.string()),
  expiresAt: z.string().datetime(),
  limits: z.object({ maxBytes: z.number().int().positive(), maxPages: z.number().int().positive() }),
});

export const JobsCreateResponseSchema = z.object({ jobId: z.string().min(1) });

export const JobsStatusResponseSchema = z.object({
  status: z.enum(["queued", "processing", "done", "error", "cancelled"]),
  result: z
    .object({
      resultJsonUrl: z.string().url(),
    })
    .optional(),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
  metrics: z
    .object({
      promptTokens: z.number().int().nonnegative().optional(),
      completionTokens: z.number().int().nonnegative().optional(),
      costUsd: z.number().nonnegative().optional(),
      durationsMs: z.record(z.number().int().nonnegative()).optional(),
    })
    .optional(),
});

export type SignedUrlResponse = z.infer<typeof SignedUrlResponseSchema>;
export type JobsCreateResponse = z.infer<typeof JobsCreateResponseSchema>;
export type JobsStatusResponse = z.infer<typeof JobsStatusResponseSchema>;


