import OpenAI from "openai";
import { z } from "zod";

const SlidesResultSchema = z.object({
  title: z.string().min(1),
  theme: z.enum(["DEFAULT", "LIGHT", "DARK"]),
  slides: z.array(
    z.object({
      title: z.string().min(1),
      bullets: z.array(z.string()).optional(),
      notes: z.string().optional(),
      layout: z.enum(["TITLE_ONLY", "TITLE_AND_BODY", "TITLE_AND_TWO_COLUMNS"]).optional(),
      images: z
        .array(
          z.object({
            url: z.string().url(),
            placement: z.enum(["LEFT", "RIGHT", "FULL_WIDTH", "BACKGROUND"]).optional(),
            widthPx: z.number().int().nonnegative().optional(),
          })
        )
        .optional(),
    })
  ),
});

export type SlidesResult = z.infer<typeof SlidesResultSchema>;

export class LlmClient {
  private readonly client: OpenAI;
  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  private dbg(label: string, payload: unknown) {
    if (process.env.DEBUG_LLM === "true") {
      // eslint-disable-next-line no-console
      console.log(`[LLM] ${label}`, typeof payload === "string" ? payload : JSON.stringify(payload).slice(0, 1000));
    }
  }

  private getJsonSchemaObject() {
    // Hand-written JSON Schema matching SlidesResultSchema
    return {
      type: "object",
      additionalProperties: false,
      required: ["title", "theme", "slides"],
      properties: {
        title: { type: "string", minLength: 1 },
        theme: { type: "string", enum: ["DEFAULT", "LIGHT", "DARK"] },
        slides: {
          type: "array",
          minItems: 1,
          maxItems: 200,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title"],
            properties: {
              title: { type: "string", minLength: 1 },
              bullets: { type: "array", items: { type: "string" } },
              notes: { type: "string" },
              layout: { type: "string", enum: ["TITLE_ONLY", "TITLE_AND_BODY", "TITLE_AND_TWO_COLUMNS"] },
              images: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["url"],
                  properties: {
                    url: { type: "string", format: "uri" },
                    placement: { type: "string", enum: ["LEFT", "RIGHT", "FULL_WIDTH", "BACKGROUND"] },
                    widthPx: { type: "integer", minimum: 0 },
                  },
                },
              },
            },
          },
        },
      },
    } as const;
  }

  async generateSlides(params: {
    pages: Array<{ index: number; text: string }>;
    images: Array<{ page: number; url: string }>;
    maxSlides?: number;
    language?: string;
    theme?: "DEFAULT" | "LIGHT" | "DARK";
  }): Promise<SlidesResult> {
    const totalTextChars = (params.pages || []).reduce((sum, p) => sum + (p.text ? p.text.length : 0), 0);
    const lowText = totalTextChars < 500;

    const system = [
      "You convert PDF content into a slide deck JSON that must strictly match the provided JSON Schema.",
      "You will receive: (1) a JSON payload describing extracted text and constraints, and (2) a sequence of page images.",
      "Rules:",
      "- Output JSON only (no prose).",
      "- Use ONLY URLs from allowedImageUrls for images in the result. External URLs are forbidden.",
      "- If the text is sparse or OCR seems needed, rely on the provided page images (visual reasoning) to infer slide content.",
      "- Include at least minImages images. If uncertain, use page 1 as BACKGROUND on the title slide; optionally page 2 as RIGHT on the next slide.",
    ].join(" ");

    const inputPayload = {
      constraints: {
        maxSlides: params.maxSlides ?? 30,
        language: params.language ?? "auto",
        theme: params.theme ?? "DEFAULT",
      },
      document: { pages: params.pages, images: params.images },
      allowedImageUrls: params.images.map((i) => i.url),
      minImages: lowText ? 3 : 1,
      imagePlacementGuidance: {
        titleBackgroundFromPage1: true,
        secondaryRightFromPage2: true
      },
      guidelines: [
        "Short headings, concise bullets",
        "Include relevant page images",
        "No extraneous text",
      ],
      hints: {
        lowText,
        preferVisualUnderstanding: lowText,
      },
    };

    const jsonSchema = this.getJsonSchemaObject();

    // Attempt 1: strict JSON Schema response_format
    let content = "{}";
    try {
      this.dbg("attempt1.input", {
        pages: params.pages.length,
        images: params.images.length,
        allowedImageUrls: inputPayload.allowedImageUrls.length,
        minImages: inputPayload.minImages,
        lowText,
      });
      const userContent: any[] = [
        { type: "text", text: JSON.stringify(inputPayload) },
      ];
      if ((params.images || []).length > 0) {
        userContent.push({ type: "text", text: `Below are ${params.images.length} page images in reading order:` });
        for (const img of params.images) {
          userContent.push({ type: "image_url", image_url: { url: img.url } });
        }
      }
      const completion = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_schema", json_schema: { name: "SlidesResult", schema: jsonSchema, strict: true } as any },
        messages: [
          { role: "system", content: system },
          { role: "user", content: userContent as any },
        ],
        temperature: 0.1,
        max_tokens: 6000,
      });
      content = completion.choices[0]?.message?.content || "{}";
      this.dbg("attempt1.raw", String(content).slice(0, 1000));
      const parsed1 = SlidesResultSchema.safeParse(JSON.parse(content));
      if (parsed1.success) {
        const urls = (parsed1.data.slides || []).flatMap((s) => s.images || []).map((im) => im.url);
        this.dbg("attempt1.parsed", { slides: parsed1.data.slides.length, images: urls.length });
        return parsed1.data;
      }
    } catch {
      // fallthrough to repair
    }

    // Attempt 2: repair prompt with explicit schema and previous output + whitelist enforcement
    const repairPrompt = {
      instruction:
        "Your previous output did not validate. Return a single JSON object that validates strictly. IMPORTANT: All images[].url MUST be chosen only from allowedImageUrls; external URLs are forbidden.",
      schema: jsonSchema,
      previous: content,
      allowedImageUrls: inputPayload.allowedImageUrls,
    };
    const userRepairContent: any[] = [
      { type: "text", text: JSON.stringify(repairPrompt) },
    ];
    if ((params.images || []).length > 0) {
      userRepairContent.push({ type: "text", text: `Reference page images again (${params.images.length}):` });
      for (const img of params.images) {
        userRepairContent.push({ type: "image_url", image_url: { url: img.url } });
      }
    }
    const completion2 = await this.client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userRepairContent as any },
      ],
      temperature: 0.0,
      max_tokens: 6000,
    });
    const content2 = completion2.choices[0]?.message?.content || "{}";
    this.dbg("attempt2.raw", String(content2).slice(0, 1000));
    const parsed2 = SlidesResultSchema.safeParse(JSON.parse(content2));
    if (parsed2.success) {
      const all = (parsed2.data.slides || []).flatMap((s) => s.images || []).map((im) => im.url);
      this.dbg("attempt2.parsed", { slides: parsed2.data.slides.length, images: all.length });
      return parsed2.data;
    }

    throw new Error("LLM response did not match schema after repair");
  }
}


