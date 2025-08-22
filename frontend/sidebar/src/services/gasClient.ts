import type { 
  SignedUrlResponse, 
  JobCreateResponse, 
  JobStatusResponse, 
  ApplyResult 
} from '../types';
import { ERROR_MESSAGES } from '../constants';
import { createAppError } from '../utils';
import { 
  SignedUrlResponseSchema,
  JobCreateResponseSchema,
  JobStatusSchema,
  ApplyResultSchema,
} from '../schemas';



class GASClient {
  private isAvailable(): boolean {
    return !!(
      typeof window !== 'undefined' &&
      window.google?.script?.run
    );
  }

  private async executeFunction<T>(
    functionName: string,
    ...args: unknown[]
  ): Promise<T> {
    if (!this.isAvailable()) {
      throw createAppError(
        'Google Apps Script is not available',
        'GAS_UNAVAILABLE'
      );
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(createAppError(
          'Request timeout',
          'TIMEOUT'
        ));
      }, 30000);

      try {
        window.google!.script.run
          .withSuccessHandler((result: unknown) => {
            clearTimeout(timeoutId);
            resolve(result as T);
          })
          .withFailureHandler((error: unknown) => {
            clearTimeout(timeoutId);
            reject(createAppError(
              typeof error === 'string' ? error : ERROR_MESSAGES.UNKNOWN_ERROR,
              'GAS_ERROR',
              error
            ));
          })
          [functionName](...args);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(createAppError(
          'Failed to execute Google Apps Script function',
          'GAS_EXECUTION_ERROR',
          error
        ));
      }
    });
  }

  async createSignedUrl(request: {
    fileName: string;
    contentLength: number;
    contentSha256: string;
  }): Promise<SignedUrlResponse> {
    const raw = await this.executeFunction<unknown>('apiCreateSignedUrl', request);
    const parsed = SignedUrlResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw createAppError('Invalid signed URL response', 'SCHEMA_ERROR', parsed.error.flatten());
    }
    return parsed.data as SignedUrlResponse;
  }

  async createJob(uploadId: string, options: Record<string, unknown> = {}): Promise<JobCreateResponse> {
    const raw = await this.executeFunction<unknown>('apiCreateJob', uploadId, options);
    const parsed = JobCreateResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw createAppError('Invalid job create response', 'SCHEMA_ERROR', parsed.error.flatten());
    }
    return parsed.data as JobCreateResponse;
  }

  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    const raw = await this.executeFunction<unknown>('apiGetJob', jobId);
    const parsed = JobStatusSchema.safeParse(raw);
    if (!parsed.success) {
      throw createAppError('Invalid job status response', 'SCHEMA_ERROR', parsed.error.flatten());
    }
    return parsed.data as JobStatusResponse;
  }

  async fetchResultJson(resultUrl: string): Promise<unknown> {
    return this.executeFunction<unknown>('fetchResultJson', resultUrl);
  }

  async applySlides(slidesResult: unknown): Promise<ApplyResult> {
    const raw = await this.executeFunction<unknown>('applySlides', slidesResult);
    const parsed = ApplyResultSchema.safeParse(raw);
    if (!parsed.success) {
      throw createAppError('Invalid applySlides response', 'SCHEMA_ERROR', parsed.error.flatten());
    }
    return parsed.data as ApplyResult;
  }
}

export const gasClient = new GASClient();
