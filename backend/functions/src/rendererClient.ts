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
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Renderer error ${resp.status}: ${text}`);
  }
  return (await resp.json()) as RenderResponse;
}


