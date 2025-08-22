export type RenderRequest = {
  gcsPath: string;
  dpi?: number;
  maxPages?: number;
  jobId?: string;
};

export type RenderResponse = {
  pages: Array<{ index: number; gcsObject: string; widthPx?: number; heightPx?: number }>;
};

export async function renderPdfPages(rendererUrl: string, req: RenderRequest): Promise<RenderResponse> {
  const url = new URL("/render", rendererUrl).toString();
  const timeoutMs = Number(process.env.RENDERER_TIMEOUT_MS || 30000);
  const maxRetries = Number(process.env.RENDERER_RETRIES || 1);
  let lastErr: any = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req),
        signal: ac.signal,
      });
      clearTimeout(t);
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`Renderer error ${resp.status}: ${text}`);
      }
      return (await resp.json()) as RenderResponse;
    } catch (e) {
      clearTimeout(t);
      lastErr = e;
      if (attempt < maxRetries) {
        const backoff = Math.min(2000, 200 * Math.pow(2, attempt));
        await new Promise((r) => setTimeout(r, backoff));
        continue;
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}


