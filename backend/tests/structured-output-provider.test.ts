import { z } from "zod";

const mockParse = jest.fn();
jest.mock("openai", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    responses: { parse: (...args: unknown[]) => mockParse(...args) }
  }))
}));

const { OpenAiStructuredOutputProvider } = require("../src/integrations/llm/structured-output-provider") as
  typeof import("../src/integrations/llm/structured-output-provider");
const openAiConstructor = require("openai").default as jest.Mock;

describe("OpenAiStructuredOutputProvider", () => {
  beforeEach(() => {
    mockParse.mockReset();
    openAiConstructor.mockClear();
  });

  it("uses bounded requests without response storage and maps structured output usage", async () => {
    mockParse.mockResolvedValue({
      output_parsed: { answer: "validated" },
      usage: { input_tokens: 14, output_tokens: 5 }
    });
    const provider = new OpenAiStructuredOutputProvider("test-api-key", "test-model");
    const result = await provider.generate(
      "test_output",
      "System instruction",
      "Untrusted user input",
      z.object({ answer: z.string() })
    );

    expect(openAiConstructor).toHaveBeenCalledWith({
      apiKey: "test-api-key",
      timeout: 30_000,
      maxRetries: 1
    });
    expect(mockParse).toHaveBeenCalledWith(expect.objectContaining({
      model: "test-model",
      store: false,
      max_output_tokens: 6000,
      input: [
        { role: "system", content: "System instruction" },
        { role: "user", content: "Untrusted user input" }
      ]
    }));
    expect(result).toEqual({
      output: { answer: "validated" },
      usage: { inputTokens: 14, outputTokens: 5 }
    });
  });

  it("rejects responses without parsed structured output", async () => {
    mockParse.mockResolvedValue({ output_parsed: null });
    const provider = new OpenAiStructuredOutputProvider("test-api-key", "test-model");

    await expect(provider.generate("test_output", "system", "user", z.object({ answer: z.string() })))
      .rejects.toThrow("The model did not return a structured response.");
  });

  it.each(["APIConnectionTimeoutError", "RateLimitError", "APIConnectionError"])(
    "surfaces provider errors such as %s to the workflow service",
    async (errorName) => {
      const providerError = new Error(errorName);
      providerError.name = errorName;
      mockParse.mockRejectedValue(providerError);
      const provider = new OpenAiStructuredOutputProvider("test-api-key", "test-model");

      await expect(provider.generate("test_output", "system", "user", z.object({ answer: z.string() })))
        .rejects.toBe(providerError);
    }
  );
});
