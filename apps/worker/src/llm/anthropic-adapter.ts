import {
  articleAnalysisJsonSchema,
  digestSummaryJsonSchema,
  validateArticleAnalysisResult,
  validateDigestSummaryResult,
} from './schema';
import {
  buildArticleAnalysisInstructions,
  buildArticleAnalysisPrompt,
  buildDigestSummaryInstructions,
  buildDigestSummaryPrompt,
} from './prompt';
import type {
  ArticleAnalysisInput,
  DigestSummaryInput,
  LlmAdapter,
  LlmAnalysisResponse,
  LlmDigestResponse,
  LlmUsage,
} from './types';

export class AnthropicAdapter implements LlmAdapter {
  readonly model =
    process.env.ANTHROPIC_MODEL || process.env.LLM_MODEL || 'claude-sonnet-4-5';
  readonly provider = 'anthropic';

  async analyzeArticle(
    input: ArticleAnalysisInput,
  ): Promise<LlmAnalysisResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required for Anthropic adapter');
    }

    const startedAt = Date.now();
    const response = await fetchWithTimeout(
      `${process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com'}/v1/messages`,
      {
        body: JSON.stringify({
          max_tokens: Number(process.env.LLM_MAX_TOKENS || 1800),
          messages: [
            {
              content: buildArticleAnalysisPrompt(input),
              role: 'user',
            },
          ],
          model: this.model,
          system: buildArticleAnalysisInstructions(),
          tool_choice: {
            name: 'record_article_analysis',
            type: 'tool',
          },
          tools: [
            {
              description: 'Record structured article analysis.',
              input_schema: articleAnalysisJsonSchema,
              name: 'record_article_analysis',
            },
          ],
        }),
        headers: {
          'anthropic-version': process.env.ANTHROPIC_VERSION || '2023-06-01',
          'content-type': 'application/json',
          'x-api-key': apiKey,
        },
        method: 'POST',
      },
    );

    const payload = await readJsonResponse(response);
    const rawResult = extractAnthropicToolInput(
      payload,
      'record_article_analysis',
    );

    return {
      durationMs: Date.now() - startedAt,
      model: this.model,
      provider: this.provider,
      result: validateArticleAnalysisResult(rawResult, input),
      usage: extractAnthropicUsage(payload),
    };
  }

  async summarizeDigest(
    input: DigestSummaryInput,
  ): Promise<LlmDigestResponse> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required for Anthropic adapter');
    }

    const startedAt = Date.now();
    const response = await fetchWithTimeout(
      `${process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com'}/v1/messages`,
      {
        body: JSON.stringify({
          max_tokens: Number(process.env.LLM_MAX_TOKENS || 1800),
          messages: [
            {
              content: buildDigestSummaryPrompt(input),
              role: 'user',
            },
          ],
          model: this.model,
          system: buildDigestSummaryInstructions(),
          tool_choice: {
            name: 'record_digest_summary',
            type: 'tool',
          },
          tools: [
            {
              description: 'Record structured digest summary.',
              input_schema: digestSummaryJsonSchema,
              name: 'record_digest_summary',
            },
          ],
        }),
        headers: {
          'anthropic-version': process.env.ANTHROPIC_VERSION || '2023-06-01',
          'content-type': 'application/json',
          'x-api-key': apiKey,
        },
        method: 'POST',
      },
    );

    const payload = await readJsonResponse(response);
    const rawResult = extractAnthropicToolInput(payload, 'record_digest_summary');

    return {
      durationMs: Date.now() - startedAt,
      model: this.model,
      provider: this.provider,
      result: validateDigestSummaryResult(rawResult),
      usage: extractAnthropicUsage(payload),
    };
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Number(process.env.LLM_REQUEST_TIMEOUT_MS || 60000),
  );

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Anthropic request failed with HTTP ${response.status}`);
  }

  return payload;
}

function extractAnthropicToolInput(payload: unknown, toolName: string): unknown {
  if (!isRecord(payload) || !Array.isArray(payload.content)) {
    throw new Error('Anthropic response missing content');
  }

  const toolUse = payload.content.find(
    (content) =>
      isRecord(content) &&
      content.type === 'tool_use' &&
      content.name === toolName,
  );

  if (!isRecord(toolUse) || !isRecord(toolUse.input)) {
    throw new Error('Anthropic response missing tool input');
  }

  return toolUse.input;
}

function extractAnthropicUsage(payload: unknown): LlmUsage {
  if (!isRecord(payload) || !isRecord(payload.usage)) {
    return emptyUsage();
  }

  const promptTokens =
    numberValue(payload.usage.input_tokens) +
    numberValue(payload.usage.cache_creation_input_tokens) +
    numberValue(payload.usage.cache_read_input_tokens);

  return {
    completionTokens: numberValue(payload.usage.output_tokens),
    promptTokens,
    totalTokens: promptTokens + numberValue(payload.usage.output_tokens),
  };
}

function emptyUsage(): LlmUsage {
  return {
    completionTokens: 0,
    promptTokens: 0,
    totalTokens: 0,
  };
}

function numberValue(value: unknown): number {
  return typeof value === 'number' ? value : 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
