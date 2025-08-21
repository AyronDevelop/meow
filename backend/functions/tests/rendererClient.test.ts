import { renderPdfPages } from "../lib/rendererClient.js";

describe("rendererClient", () => {
  it("parses successful response", async () => {
    const pages = [{ index: 1, gcsObject: "jobs/j123/pages/1.png" }];
    // @ts-ignore
    global.fetch = vi.fn(async () => ({ ok: true, json: async () => ({ pages }) }));
    const res = await renderPdfPages("https://renderer.example", { gcsPath: "gs://b/obj.pdf" });
    expect(res.pages[0].gcsObject).toContain("pages/1.png");
  });

  it("throws on non-200", async () => {
    // @ts-ignore
    global.fetch = vi.fn(async () => ({ ok: false, status: 500, text: async () => "boom" }));
    await expect(renderPdfPages("https://renderer.example", { gcsPath: "gs://b/obj.pdf" })).rejects.toThrow(/Renderer error 500/);
  });
});


