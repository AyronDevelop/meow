import { LlmClient } from "../lib/llm.js";

vi.mock("openai", () => {
  return {
    default: class MockOpenAI {
      chat = {
        completions: {
          create: async () => ({
            choices: [
              {
                message: { content: JSON.stringify({ title: "Deck", theme: "DEFAULT", slides: [{ title: "S1", images: [{ url: "https://example.com/i.png", placement: "RIGHT" }] }] }) },
              },
            ],
          }),
        },
      };
      constructor(_: any) {}
    },
  };
});

describe("LlmClient", () => {
  it("returns parsed slides JSON", async () => {
    const client = new LlmClient("key");
    const res = await client.generateSlides({ pages: [{ index: 1, text: "Hello" }], images: [] });
    expect(res.title).toBe("Deck");
    expect(res.slides[0].title).toBe("S1");
    expect(res.theme).toBe("DEFAULT");
    expect(res.slides[0].images?.length).toBe(0);
  });
});


