import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { z } from "zod";

export interface StructuredOutputProvider {
  readonly model?: string;

  generate<T extends z.ZodType>(
    name: string,
    systemPrompt: string,
    userPrompt: string,
    schema: T
  ): Promise<{ output: z.output<T>; usage?: ProviderUsage }>;
}

export interface ProviderUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface StructuredOutputProviderConfig {
  llmProvider: "openai" | "groq";
  openAiApiKey?: string;
  openAiModel: string;
  groqApiKey?: string;
  groqModel: string;
}

export class OpenAiStructuredOutputProvider implements StructuredOutputProvider {
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    readonly model: string,
    baseURL?: string
  ) {
    this.client = new OpenAI({
      apiKey,
      ...(baseURL ? { baseURL } : {}),
      timeout: 30_000,
      maxRetries: 1
    });
  }

  async generate<T extends z.ZodType>(
    name: string,
    systemPrompt: string,
    userPrompt: string,
    schema: T
  ): Promise<{ output: z.output<T>; usage?: ProviderUsage }> {
    const response = await this.client.responses.parse({
      model: this.model,
      store: false,
      max_output_tokens: 6000,
      input: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      text: { format: zodTextFormat(schema, name) }
    });

    if (response.output_parsed === null) {
      throw new Error("The model did not return a structured response.");
    }
    return {
      output: schema.parse(response.output_parsed),
      usage: response.usage
        ? {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens
        }
        : undefined
    };
  }
}

export class GroqStructuredOutputProvider extends OpenAiStructuredOutputProvider {
  constructor(apiKey: string, model: string) {
    super(apiKey, model, "https://api.groq.com/openai/v1");
  }
}

export function createStructuredOutputProvider(
  config: StructuredOutputProviderConfig
): StructuredOutputProvider | undefined {
  if (config.llmProvider === "groq") {
    return config.groqApiKey
        ? new GroqStructuredOutputProvider(config.groqApiKey, config.groqModel)
        : undefined;
  }

  return config.openAiApiKey
    ? new OpenAiStructuredOutputProvider(config.openAiApiKey, config.openAiModel)
    : undefined;
}
