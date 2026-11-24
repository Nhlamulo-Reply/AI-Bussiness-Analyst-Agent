import { z } from "zod";

const mockParse = jest.fn();
const mockChatParse = jest.fn();
jest.mock("openai", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    responses: { parse: (...args: unknown[]) => mockParse(...args) },
    chat: {
      completions: { parse: (...args: unknown[]) => mockChatParse(...args) }
    }
  }))
}));

const {
  createStructuredOutputProvider,
  OpenAiStructuredOutputProvider
} = require("../src/integrations/llm/structured-output-provider") as
  typeof import("../src/integrations/llm/structured-output-provider");
const openAiConstructor = require("openai").default as jest.Mock;

describe("OpenAiStructuredOutputProvider", () => {
  beforeEach(() => {
    mockParse.mockReset();
    mockChatParse.mockReset();
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
      model: "test-model",
      usage: { inputTokens: 14, outputTokens: 5 }
    });
  });

  it("rejects responses without parsed structured output", async () => {
    mockParse.mockResolvedValue({ output_parsed: null });
    const provider = new OpenAiStructuredOutputProvider("test-api-key", "test-model");

    await expect(provider.generate("test_output", "system", "user", z.object({ answer: z.string() })))
      .rejects.toThrow("The model did not return a structured response.");
  });

  it("configures Groq through its OpenAI-compatible Responses API", async () => {
    mockParse.mockResolvedValue({
      output_parsed: { answer: "validated" },
      usage: { input_tokens: 14, output_tokens: 5 }
    });
    const provider = createStructuredOutputProvider({
      llmProvider: "groq",
      groqApiKey: "test-groq-key",
      groqModel: "openai/gpt-oss-120b",
      openAiModel: "unused-model",
      geminiModel: "gemini-4-hydrogen",
      inceptionModel: "mercury-3"
    });

    expect(openAiConstructor).toHaveBeenCalledWith({
      apiKey: "test-groq-key",
      baseURL: "https://api.groq.com/openai/v1",
      timeout: 30_000,
      maxRetries: 1
    });
    if (!provider) {
      throw new Error("Groq provider was not configured.");
    }

    await provider.generate("test_output", "System instruction", "User input", z.object({ answer: z.string() }));
    expect(mockParse).toHaveBeenCalledWith(expect.objectContaining({
      model: "openai/gpt-oss-120b",
      store: false
    }));
  });

  it("tries Gemini after the primary provider returns invalid structured output", async () => {
    mockParse.mockResolvedValue({ output_parsed: { answer: 42 } });
    mockChatParse.mockResolvedValue({
      choices: [{ message: { parsed: { answer: "Gemini response" } } }],
      usage: { prompt_tokens: 18, completion_tokens: 7 }
    });
    const provider = createStructuredOutputProvider({
      llmProvider: "groq",
      groqApiKey: "test-groq-key",
      groqModel: "primary-model",
      openAiModel: "unused-model",
      geminiApiKey: "test-gemini-key",
      geminiModel: "gemini-4-hydrogen",
      inceptionApiKey: "test-inception-key",
      inceptionModel: "mercury-3"
    });

    if (!provider) {
      throw new Error("Fallback providers were not configured.");
    }
    const result = await provider.generate(
      "test_output",
      "System instruction",
      "User input",
      z.object({ answer: z.string() })
    );

    expect(openAiConstructor).toHaveBeenNthCalledWith(2, {
      apiKey: "test-gemini-key",
      baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
      timeout: 30_000,
      maxRetries: 1
    });
    expect(mockChatParse).toHaveBeenCalledWith(expect.objectContaining({
      model: "gemini-4-hydrogen",
      max_tokens: 6000,
      response_format: expect.objectContaining({ type: "json_schema" })
    }));
    expect(result).toEqual({
      output: { answer: "Gemini response" },
      model: "gemini-4-hydrogen",
      usage: { inputTokens: 18, outputTokens: 7 }
    });
  });

  it("tries Inception after both the primary provider and Gemini fail", async () => {
    mockParse.mockRejectedValue(new Error("primary unavailable"));
    mockChatParse
      .mockRejectedValueOnce(new Error("Gemini unavailable"))
      .mockResolvedValueOnce({
        choices: [{ message: { parsed: { answer: "Inception response" } } }]
      });
    const provider = createStructuredOutputProvider({
      llmProvider: "openai",
      openAiApiKey: "test-openai-key",
      openAiModel: "primary-model",
      groqModel: "unused-model",
      geminiApiKey: "test-gemini-key",
      geminiModel: "gemini-4-hydrogen",
      inceptionApiKey: "test-inception-key",
      inceptionModel: "mercury-3"
    });

    if (!provider) {
      throw new Error("Fallback providers were not configured.");
    }
    const result = await provider.generate(
      "test_output",
      "System instruction",
      "User input",
      z.object({ answer: z.string() })
    );

    expect(openAiConstructor).toHaveBeenNthCalledWith(3, {
      apiKey: "test-inception-key",
      baseURL: "https://api.inceptionlabs.ai/v1",
      timeout: 30_000,
      maxRetries: 1
    });
    expect(mockChatParse).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      output: { answer: "Inception response" },
      model: "mercury-3",
      usage: undefined
    });
  });

  it("uses configured fallbacks when the primary credential is absent", async () => {
    mockChatParse.mockResolvedValue({
      choices: [{ message: { parsed: { answer: "Inception response" } } }]
    });
    const provider = createStructuredOutputProvider({
      llmProvider: "openai",
      openAiModel: "primary-model",
      groqModel: "unused-model",
      geminiModel: "gemini-4-hydrogen",
      inceptionApiKey: "test-inception-key",
      inceptionModel: "mercury-3"
    });

    if (!provider) {
      throw new Error("Configured fallback was not created.");
    }
    const result = await provider.generate(
      "test_output",
      "system",
      "user",
      z.object({ answer: z.string() })
    );

    expect(result.model).toBe("mercury-3");
    expect(mockParse).not.toHaveBeenCalled();
    expect(mockChatParse).toHaveBeenCalledTimes(1);
  });

  it("reports all-provider failure without including provider error details", async () => {
    mockParse.mockRejectedValue(new Error("private provider response"));
    mockChatParse.mockRejectedValue(new Error("private provider response"));
    const logger = { warn: jest.fn() };
    const provider = createStructuredOutputProvider({
      llmProvider: "openai",
      openAiApiKey: "test-openai-key",
      openAiModel: "primary-model",
      groqModel: "unused-model",
      geminiApiKey: "test-gemini-key",
      geminiModel: "gemini-4-hydrogen",
      inceptionApiKey: "test-inception-key",
      inceptionModel: "mercury-3"
    }, logger);

    if (!provider) {
      throw new Error("Fallback providers were not configured.");
    }
    await expect(provider.generate(
      "test_output",
      "system",
      "user",
      z.object({ answer: z.string() })
    )).rejects.toThrow("All configured structured-output providers failed.");
    expect(logger.warn).toHaveBeenCalledTimes(3);
    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.objectContaining({ errorMessage: expect.anything() }),
      expect.anything()
    );
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
