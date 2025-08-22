export interface BackoffOptions {
  readonly baseMs?: number;
  readonly maxMs?: number;
  readonly factor?: number; 
  readonly jitter?: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export function backoffDelay(attempt: number, opts: BackoffOptions = {}): number {
  const base = opts.baseMs ?? 500;
  const factor = opts.factor ?? 2;
  const max = opts.maxMs ?? 30_000;
  const jitter = clamp(opts.jitter ?? 0.2, 0, 1);

  const pure = Math.min(base * Math.pow(factor, Math.max(0, attempt - 1)), max);
  const rand = (Math.random() * 2 - 1) * jitter;
  const withJitter = pure * (1 + rand);
  return Math.round(clamp(withJitter, base, max));
}

export async function backoffWait(attempt: number, opts?: BackoffOptions): Promise<void> {
  const ms = backoffDelay(attempt, opts);
  await new Promise((r) => setTimeout(r, ms));
}


