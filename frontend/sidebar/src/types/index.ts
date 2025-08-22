export interface FileInfo {
  readonly name: string;
  readonly size: number;
  readonly type?: string;
}

export interface SignedUrlResponse {
  readonly uploadId: string;
  readonly uploadUrl: string;
  readonly headers?: Readonly<Record<string, string>>;
}

export interface JobCreateResponse {
  readonly jobId: string;
}

export interface JobStatusResponse {
  readonly status: JobStatus;
  readonly result?: {
    readonly resultJsonUrl: string;
  };
  readonly error?: unknown;
  readonly metrics?: unknown;
}

export interface ApplyResult {
  readonly inserted: number;
  readonly ok: boolean;
  readonly events?: readonly string[];
}

export type JobStatus = 'pending' | 'running' | 'queued' | 'processing' | 'done' | 'error' | 'cancelled';

export type ProcessingPhase = 
  | 'idle' 
  | 'hashing' 
  | 'signing' 
  | 'uploading' 
  | 'creating' 
  | 'polling' 
  | 'downloading' 
  | 'applying' 
  | 'done' 
  | 'error';

export interface ProcessingState {
  readonly phase: ProcessingPhase;
  readonly status: string;
  readonly progress: number | null;
  readonly busy: boolean;
}

export interface AppError extends Error {
  code?: string;
  details?: unknown;
}

declare global {
  interface Window {
    google?: {
      script: {
        run: {
          withSuccessHandler: (callback: (result: unknown) => void) => {
            withFailureHandler: (callback: (error: unknown) => void) => {
              [key: string]: (...args: unknown[]) => void;
            };
          };
        };
      };
    };
  }
}
