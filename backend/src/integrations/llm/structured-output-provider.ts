import OpenAI from "openai";
import { zodResponseFormat, zodTextFormat } from "openai/helpers/zod";
import type { Logger } from "pino";
import type { z } from "zod";

export interface StructuredOutputProvider {
  readonly model?: string;

  generate<T extends z.ZodType>(
    name: string,
    systemPrompt: string,
    userPrompt: string,
    schema: T
  ): Promise<{ output: z.output<T>; model?: string; usage?: ProviderUsage }>;
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
  geminiApiKey?: string;
  geminiModel: string;
  inceptionApiKey?: string;
  inceptionModel: string;
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
  ): Promise<{ output: z.output<T>; model?: string; usage?: ProviderUsage }> {
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
      model: this.model,
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

export class OpenAiCompatibleChatStructuredOutputProvider
  implements StructuredOutputProvider
{
  private readonly client: OpenAI;

  constructor(
    apiKey: string,
    readonly model: string,
    baseURL: string,
  ) {
    this.client = new OpenAI({
      apiKey,
      baseURL,
      timeout: 30_000,
      maxRetries: 1,
    });
  }

  async generate<T extends z.ZodType>(
    name: string,
    systemPrompt: string,
    userPrompt: string,
    schema: T,
  ): Promise<{ output: z.output<T>; model?: string; usage?: ProviderUsage }> {
    const response = await this.client.chat.completions.parse({
      model: this.model,
      max_tokens: 6000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: zodResponseFormat(schema, name),
    });
    const parsed = response.choices[0]?.message.parsed;
    if (parsed === null || parsed === undefined) {
      throw new Error("The model did not return a structured response.");
    }

    return {
      output: schema.parse(parsed),
      model: this.model,
      usage: response.usage
        ? {
            inputTokens: response.usage.prompt_tokens,
            outputTokens: response.usage.completion_tokens,
          }
        : undefined,
    };
  }
}

export class GeminiStructuredOutputProvider extends OpenAiCompatibleChatStructuredOutputProvider {
  constructor(apiKey: string, model: string) {
    super(
      apiKey,
      model,
      "https://generativelanguage.googleapis.com/v1beta/openai/",
    );
  }
}

export class InceptionStructuredOutputProvider extends OpenAiCompatibleChatStructuredOutputProvider {
  constructor(apiKey: string, model: string) {
    super(apiKey, model, "https://api.inceptionlabs.ai/v1");
  }
}

export class FallbackStructuredOutputProvider implements StructuredOutputProvider {
  readonly model?: string;

  constructor(
    private readonly providers: StructuredOutputProvider[],
    private readonly logger?: Pick<Logger, "warn">,
  ) {
    this.model = providers[0]?.model;
  }

  async generate<T extends z.ZodType>(
    name: string,
    systemPrompt: string,
    userPrompt: string,
    schema: T,
  ): Promise<{ output: z.output<T>; model?: string; usage?: ProviderUsage }> {
    for (const [index, provider] of this.providers.entries()) {
      try {
        return await provider.generate(name, systemPrompt, userPrompt, schema);
      } catch (error) {
        this.logger?.warn(
          {
            providerModel: provider.model,
            errorName: error instanceof Error ? error.name : "UnknownError",
          },
          index < this.providers.length - 1
            ? "LLM provider failed; trying the next configured provider"
            : "LLM provider failed; no configured providers remain",
        );
      }
    }

    throw new Error("All configured structured-output providers failed.");
  }
}

export function createStructuredOutputProvider(
  config: StructuredOutputProviderConfig,
  logger?: Pick<Logger, "warn">,
): StructuredOutputProvider | undefined {
  const providers: StructuredOutputProvider[] = [];
  if (config.llmProvider === "groq") {
    if (config.groqApiKey) {
      providers.push(
        new GroqStructuredOutputProvider(config.groqApiKey, config.groqModel),
      );
    }
  } else if (config.openAiApiKey) {
    providers.push(
      new OpenAiStructuredOutputProvider(
        config.openAiApiKey,
        config.openAiModel,
      ),
    );
  }

  if (config.geminiApiKey) {
    providers.push(
      new GeminiStructuredOutputProvider(
        config.geminiApiKey,
        config.geminiModel,
      ),
    );
  }
  if (config.inceptionApiKey) {
    providers.push(
      new InceptionStructuredOutputProvider(
        config.inceptionApiKey,
        config.inceptionModel,
      ),
    );
  }

  if (providers.length === 0) {
    return undefined;
  }
  return providers.length === 1
    ? providers[0]
    : new FallbackStructuredOutputProvider(providers, logger);
}
