import assert from 'node:assert/strict';
import test from 'node:test';

import type { ArticleAnalysisInput } from '../llm/types';
import {
  applyCategoryRules,
  entityLookupWhere,
} from './article-processing.worker';

test('category rules add include matches and let excludes override LLM output', () => {
  const input: ArticleAnalysisInput = {
    articleId: 'article-1',
    axes: [],
    categories: [
      {
        excludeKeywords: ['sponsored'],
        id: 'category-ai',
        includeKeywords: ['openai'],
        name: 'AI',
      },
      {
        excludeKeywords: [],
        id: 'category-devtools',
        includeKeywords: ['typescript'],
        name: 'DevTools',
      },
    ],
    sourceUrl: 'https://example.com/news',
    text: 'OpenAI published a sponsored post about TypeScript tooling.',
    title: 'OpenAI tooling update',
  };

  assert.deepEqual(applyCategoryRules(input, ['category-ai']), [
    'category-devtools',
  ]);
});

test('entity lookup can merge aliases across extracted entity types', () => {
  assert.deepEqual(entityLookupWhere('user-1', 'openai', ['openai inc']), {
    OR: [
      {
        normalizedName: 'openai',
      },
      {
        aliases: {
          some: {
            normalizedAlias: {
              in: ['openai inc'],
            },
          },
        },
      },
    ],
    userId: 'user-1',
  });
});
