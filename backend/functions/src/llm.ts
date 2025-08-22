import OpenAI from "openai";
import { z } from "zod";

const SlidesResultSchema = z.object({
  title: z.string().min(1),
  theme: z.literal("DEFAULT"),
  slides: z.array(
    z.object({
      title: z.string().min(1),
      bullets: z.array(z.string()).optional(),
      notes: z.string().optional(),
      images: z
        .array(
          z.object({
            url: z.string().url(),
            placement: z.literal("RIGHT").optional(),
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
        theme: { type: "string", enum: ["DEFAULT"] },
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
              images: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["url"],
                  properties: {
                    url: { type: "string", format: "uri" },
                    placement: { type: "string", enum: ["RIGHT"] },
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
      "- Theme is fixed to DEFAULT. Do not propose other themes.",
      "- Generate EXACTLY one slide per page, preserving the original page order.",
      "- Do NOT include any images in the output JSON; backend will attach images.",
      "- For each slide, produce 3-6 concise, information-dense bullet points and add 2-4 sentence 'notes'.",
    ].join(" ");

    const imagesCount = Array.isArray(params.images) ? params.images.length : 0;
    const pagesCount = Array.isArray(params.pages) ? params.pages.length : 0;
    const targetSlides = Math.max(1, imagesCount > 0 ? imagesCount : pagesCount);

    const inputPayload = {
      constraints: {
        maxSlides: targetSlides,
        language: params.language ?? "auto",
        theme: "DEFAULT",
      },
      document: { pages: params.pages, images: params.images },
      allowedImageUrls: params.images.map((i) => i.url),
      minImages: 0,
      imagePlacementGuidance: {
        rightImagePreferred: true
      },
      guidelines: [
        "Short headings",
        "3-6 concise but detailed bullets per slide",
        "Always include 'notes' with 2-4 sentences of key insights",
        "No extraneous or filler text",
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
        userContent.push({ type: "text", text: `There are ${params.images.length} pages. Generate EXACTLY one slide per page in the same order.` });
        for (const img of params.images) {
          userContent.push({ type: "image_url", image_url: { url: img.url } });
        }
      } else {
        userContent.push({ type: "text", text: `There are ${params.pages.length} pages. Generate EXACTLY one slide per page in the same order.` });
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
        // Force text-only output and exact slide count: 1 slide per page
        const desired = targetSlides;
        const generated = (parsed1.data.slides || []).slice(0, desired);
        const normalized = Array.from({ length: desired }, (_v, i) => {
          const s = generated[i];
          return {
            title: s?.title || `Page ${i + 1}`,
            bullets: Array.isArray(s?.bullets) ? s!.bullets : undefined,
            notes: typeof s?.notes === "string" ? s!.notes : undefined,
            images: [],
          };
        });
        const trimmed = {
          title: parsed1.data.title || "Generated Deck",
          theme: "DEFAULT" as const,
          slides: normalized,
        } satisfies SlidesResult;
        const imageUrls: string[] = [];
        this.dbg("attempt1.parsed", { slides: trimmed.slides.length, images: imageUrls.length });
        return trimmed;
      }
    } catch (err) {
      this.dbg("attempt1.error", String(err instanceof Error ? err.message : err));
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
      userRepairContent.push({ type: "text", text: `There are ${params.images.length} pages. Generate EXACTLY one slide per page in the same order.` });
      for (const img of params.images) {
        userRepairContent.push({ type: "image_url", image_url: { url: img.url } });
      }
    } else {
      userRepairContent.push({ type: "text", text: `There are ${params.pages.length} pages. Generate EXACTLY one slide per page in the same order.` });
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
      const desired = targetSlides;
      const generated = (parsed2.data.slides || []).slice(0, desired);
      const normalized = Array.from({ length: desired }, (_v, i) => {
        const s = generated[i];
        return {
          title: s?.title || `Page ${i + 1}`,
          bullets: Array.isArray(s?.bullets) ? s!.bullets : undefined,
          notes: typeof s?.notes === "string" ? s!.notes : undefined,
          images: [],
        };
      });
      const trimmed = {
        title: parsed2.data.title || "Generated Deck",
        theme: "DEFAULT" as const,
        slides: normalized,
      } satisfies SlidesResult;
      const imageUrls2: string[] = [];
      this.dbg("attempt2.parsed", { slides: trimmed.slides.length, images: imageUrls2.length });
      return trimmed;
    }

    throw new Error("LLM response did not match schema after repair");
  }
}


