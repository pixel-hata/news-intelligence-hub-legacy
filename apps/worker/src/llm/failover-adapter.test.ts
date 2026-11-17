import assert from 'node:assert/strict';
import test from 'node:test';

import { FailoverLlmAdapter } from './failover-adapter';
import type {
  ArticleAnalysisInput,
  DigestSummaryInput,
  LlmAdapter,
  LlmAnalysisResponse,
  LlmDigestResponse,
} from './types';

const input: ArticleAnalysisInput = {
  articleId: 'article-1',
  axes: [],
  categories: [],
  sourceUrl: 'https://example.com/article',
  text: 'OpenAI and Anthropic released tooling for enterprise AI teams.',
  title: 'Enterprise AI tooling expands',
};

const digestInput: DigestSummaryInput = {
  articleCount: 1,
  highImportanceCount: 1,
  keyArticles: [
    {
      importance: 'high',
      summary: 'OpenAI launched controls.',
      title: 'OpenAI controls',
    },
  ],
  periodLabel: 'week',
  topCategories: [],
  topEntities: [],
};

test('uses fallback adapter when primary adapter fails', async () => {
  const calls: string[] = [];
  const primary = fakeAdapter('openai', async () => {
    calls.push('primary');
    throw new Error('primary outage');
  });
  const fallback = fakeAdapter('anthropic', async () => {
    calls.push('fallback');
    return response('anthropic');
  });

  const adapter = new FailoverLlmAdapter([primary, fallback]);
  const result = await adapter.analyzeArticle(input);

  assert.deepEqual(calls, ['primary', 'fallback']);
  assert.equal(result.provider, 'anthropic');
  assert.equal(result.result.importance, 'normal');
});

test('throws a combined error when every adapter fails', async () => {
  const adapter = new FailoverLlmAdapter([
    fakeAdapter('openai', async () => {
      throw new Error('openai down');
    }),
    fakeAdapter('anthropic', async () => {
      throw new Error('anthropic down');
    }),
  ]);

  await assert.rejects(
    () => adapter.analyzeArticle(input),
    /All LLM adapters failed: openai:openai down \| anthropic:anthropic down/,
  );
});

test('uses fallback adapter for digest summaries', async () => {
  const calls: string[] = [];
  const primary = fakeAdapter(
    'openai',
    async () => response('openai'),
    async () => {
      calls.push('primary');
      throw new Error('primary digest outage');
    },
  );
  const fallback = fakeAdapter(
    'anthropic',
    async () => response('anthropic'),
    async () => {
      calls.push('fallback');
      return digestResponse('anthropic');
    },
  );

  const adapter = new FailoverLlmAdapter([primary, fallback]);
  const result = await adapter.summarizeDigest(digestInput);

  assert.deepEqual(calls, ['primary', 'fallback']);
  assert.equal(result.provider, 'anthropic');
  assert.equal(result.result.summary, 'Digest summary.');
});

function fakeAdapter(
  provider: 'anthropic' | 'mock' | 'openai',
  analyzeArticle: (
    input: ArticleAnalysisInput,
  ) => Promise<LlmAnalysisResponse>,
  summarizeDigest: (
    input: DigestSummaryInput,
  ) => Promise<LlmDigestResponse> = async () => digestResponse(provider),
): LlmAdapter {
  return {
    analyzeArticle,
    model: `${provider}-test-model`,
    provider,
    summarizeDigest,
  };
}

function response(
  provider: 'anthropic' | 'mock' | 'openai',
): LlmAnalysisResponse {
  return {
    durationMs: 12,
    model: `${provider}-test-model`,
    provider,
    result: {
      axisLabelIds: [],
      categoryIds: [],
      entities: [],
      importance: 'normal',
      summary: 'Enterprise AI tooling expanded.',
    },
    usage: {
      completionTokens: 10,
      promptTokens: 20,
      totalTokens: 30,
    },
  };
}

function digestResponse(
  provider: 'anthropic' | 'mock' | 'openai',
): LlmDigestResponse {
  return {
    durationMs: 14,
    model: `${provider}-test-model`,
    provider,
    result: {
      summary: 'Digest summary.',
    },
    usage: {
      completionTokens: 8,
      promptTokens: 16,
      totalTokens: 24,
    },
  };
}
