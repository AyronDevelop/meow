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
    const system = "You convert PDF text into a slide deck JSON strictly matching the provided JSON Schema. Output JSON only.";
    const inputPayload = {
      constraints: {
        maxSlides: params.maxSlides ?? 30,
        language: params.language ?? "auto",
        theme: params.theme ?? "DEFAULT",
      },
      document: {
        pages: params.pages,
        images: params.images,
      },
      guidelines: [
        "Short headings, concise bullets",
        "Include relevant page images",
        "No extraneous text",
      ],
    };

    const jsonSchema = this.getJsonSchemaObject();

    // Attempt 1: strict JSON Schema response_format
    let content = "{}";
    try {
      const completion = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_schema", json_schema: { name: "SlidesResult", schema: jsonSchema, strict: true } as any },
        messages: [
          { role: "system", content: system },
          { role: "user", content: JSON.stringify(inputPayload) },
        ],
        temperature: 0.1,
        max_tokens: 6000,
      });
      content = completion.choices[0]?.message?.content || "{}";
      const parsed1 = SlidesResultSchema.safeParse(JSON.parse(content));
      if (parsed1.success) return parsed1.data;
    } catch {
      // fallthrough to repair
    }

    // Attempt 2: repair prompt with explicit schema and previous output
    const repairPrompt = {
      instruction:
        "Your previous output did not validate against the schema. Return a single JSON object that validates strictly against the schema below. Do not include any prose.",
      schema: jsonSchema,
      previous: content,
    };
    const completion2 = await this.client.chat.completions.create({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(repairPrompt) },
      ],
      temperature: 0.0,
      max_tokens: 6000,
    });
    const content2 = completion2.choices[0]?.message?.content || "{}";
    const parsed2 = SlidesResultSchema.safeParse(JSON.parse(content2));
    if (parsed2.success) return parsed2.data;

    throw new Error("LLM response did not match schema after repair");
  }
}


