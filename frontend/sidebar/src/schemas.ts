import { z } from 'zod';

export const SignedUrlResponseSchema = z.object({
  uploadId: z.string().min(1),
  uploadUrl: z.string().url(),
  headers: z.record(z.string()).optional(),
  expiresAt: z.string().datetime().optional(),
  limits: z
    .object({
      maxBytes: z.number().int().positive(),
      maxPages: z.number().int().positive(),
    })
    .optional(),
});

export type SignedUrlResponseZ = z.infer<typeof SignedUrlResponseSchema>;

export const JobCreateResponseSchema = z.object({
  jobId: z.string().min(1),
});

export type JobCreateResponseZ = z.infer<typeof JobCreateResponseSchema>;

export const JobStatusSchema = z.object({
  status: z.enum(['queued', 'processing', 'done', 'error', 'cancelled']),
  result: z
    .object({
      resultJsonUrl: z.string().url(),
    })
    .optional(),
  error: z.unknown().optional(),
  metrics: z.unknown().optional(),
});

export type JobStatusZ = z.infer<typeof JobStatusSchema>;

export const ApplyResultSchema = z.object({
  inserted: z.number(),
  ok: z.boolean(),
  events: z.array(z.string()).optional(),
});

export type ApplyResultZ = z.infer<typeof ApplyResultSchema>;


