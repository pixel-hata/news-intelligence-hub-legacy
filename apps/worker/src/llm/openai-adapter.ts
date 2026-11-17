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

export class OpenAiAdapter implements LlmAdapter {
  readonly model = process.env.OPENAI_MODEL || process.env.LLM_MODEL || 'gpt-5-mini';
  readonly provider = 'openai';

  async analyzeArticle(
    input: ArticleAnalysisInput,
  ): Promise<LlmAnalysisResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for OpenAI adapter');
    }

    const startedAt = Date.now();
    const response = await fetchWithTimeout(
      `${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/responses`,
      {
        body: JSON.stringify({
          input: [
            {
              content: buildArticleAnalysisInstructions(),
              role: 'developer',
            },
            {
              content: buildArticleAnalysisPrompt(input),
              role: 'user',
            },
          ],
          max_output_tokens: Number(process.env.LLM_MAX_TOKENS || 1800),
          model: this.model,
          text: {
            format: {
              name: 'article_analysis',
              schema: articleAnalysisJsonSchema,
              strict: true,
              type: 'json_schema',
            },
          },
        }),
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        method: 'POST',
      },
    );

    const payload = await readJsonResponse(response);
    const rawResult = JSON.parse(extractOpenAiOutputText(payload));

    return {
      durationMs: Date.now() - startedAt,
      model: this.model,
      provider: this.provider,
      result: validateArticleAnalysisResult(rawResult, input),
      usage: extractOpenAiUsage(payload),
    };
  }

  async summarizeDigest(
    input: DigestSummaryInput,
  ): Promise<LlmDigestResponse> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required for OpenAI adapter');
    }

    const startedAt = Date.now();
    const response = await fetchWithTimeout(
      `${process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'}/responses`,
      {
        body: JSON.stringify({
          input: [
            {
              content: buildDigestSummaryInstructions(),
              role: 'developer',
            },
            {
              content: buildDigestSummaryPrompt(input),
              role: 'user',
            },
          ],
          max_output_tokens: Number(process.env.LLM_MAX_TOKENS || 1800),
          model: this.model,
          text: {
            format: {
              name: 'digest_summary',
              schema: digestSummaryJsonSchema,
              strict: true,
              type: 'json_schema',
            },
          },
        }),
        headers: {
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
        },
        method: 'POST',
      },
    );

    const payload = await readJsonResponse(response);
    const rawResult = JSON.parse(extractOpenAiOutputText(payload));

    return {
      durationMs: Date.now() - startedAt,
      model: this.model,
      provider: this.provider,
      result: validateDigestSummaryResult(rawResult),
      usage: extractOpenAiUsage(payload),
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
    throw new Error(`OpenAI request failed with HTTP ${response.status}`);
  }

  return payload;
}

function extractOpenAiOutputText(payload: unknown): string {
  if (!isRecord(payload) || !Array.isArray(payload.output)) {
    throw new Error('OpenAI response missing output');
  }

  for (const output of payload.output) {
    if (!isRecord(output) || !Array.isArray(output.content)) {
      continue;
    }

    for (const content of output.content) {
      if (isRecord(content) && typeof content.text === 'string') {
        return content.text;
      }
    }
  }

  throw new Error('OpenAI response missing output text');
}

function extractOpenAiUsage(payload: unknown): LlmUsage {
  if (!isRecord(payload) || !isRecord(payload.usage)) {
    return emptyUsage();
  }

  return {
    completionTokens: numberValue(payload.usage.output_tokens),
    promptTokens: numberValue(payload.usage.input_tokens),
    totalTokens: numberValue(payload.usage.total_tokens),
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
