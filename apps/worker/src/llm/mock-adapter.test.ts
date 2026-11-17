import assert from 'node:assert/strict';
import test from 'node:test';

import { MockLlmAdapter } from './mock-adapter';
import type { ArticleAnalysisInput, DigestSummaryInput } from './types';

const baseInput: ArticleAnalysisInput = {
  articleId: 'article-1',
  axes: [
    {
      id: 'axis-1',
      labels: [
        {
          id: 'label-1',
          name: 'news',
        },
      ],
      name: 'Content type',
      prompt: 'Classify content type.',
    },
  ],
  categories: [
    {
      excludeKeywords: [],
      id: 'category-1',
      includeKeywords: ['ai'],
      name: 'AI',
    },
  ],
  sourceUrl: 'https://example.com/article',
  text: '',
  title: 'OpenAI partners with Microsoft',
};

test('mock entity extraction ignores page chrome and social UI words', async () => {
  const response = await new MockLlmAdapter().analyzeArticle({
    ...baseInput,
    text: [
      'Read More Unlike Share Thursday Everyone Startup Rock After For You That They',
      'OpenAI and Microsoft released new AI infrastructure controls.',
    ].join(' '),
  });

  const names = response.result.entities.map((entity) => entity.name);
  assert.ok(names.includes('OpenAI'));
  assert.ok(names.includes('Microsoft'));
  assert.equal(names.includes('Read'), false);
  assert.equal(names.includes('Unlike'), false);
  assert.equal(names.includes('Thursday'), false);
  assert.equal(names.includes('Everyone'), false);
  assert.equal(names.includes('Startup Rock'), false);
  assert.equal(names.includes('After'), false);
  assert.equal(names.includes('For'), false);
  assert.equal(names.includes('You'), false);
  assert.equal(names.includes('That'), false);
  assert.equal(names.includes('They'), false);
});

test('mock digest summary records token usage through the LLM interface', async () => {
  const input: DigestSummaryInput = {
    articleCount: 2,
    highImportanceCount: 1,
    keyArticles: [
      {
        importance: 'high',
        summary: 'OpenAI expanded enterprise agent controls.',
        title: 'OpenAI expands enterprise controls',
      },
    ],
    periodLabel: 'week',
    topCategories: [
      {
        count: 2,
        name: 'AI Infrastructure',
      },
    ],
    topEntities: [
      {
        count: 2,
        name: 'OpenAI',
      },
    ],
  };

  const response = await new MockLlmAdapter().summarizeDigest(input);

  assert.equal(response.provider, 'mock');
  assert.match(response.result.summary, /2 processed articles/);
  assert.ok(response.usage.totalTokens > 0);
});
