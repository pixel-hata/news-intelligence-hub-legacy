import assert from 'node:assert/strict';
import test from 'node:test';

import {
  validateArticleAnalysisResult,
  validateDigestSummaryResult,
} from './schema';
import type { ArticleAnalysisInput } from './types';

const input: ArticleAnalysisInput = {
  articleId: 'article-1',
  axes: [
    {
      id: 'axis-1',
      labels: [
        {
          id: 'label-1',
          name: 'high',
        },
      ],
      name: 'Impact',
      prompt: 'Classify impact.',
    },
  ],
  categories: [
    {
      excludeKeywords: [],
      id: 'category-1',
      includeKeywords: ['infrastructure'],
      name: 'AI Infrastructure',
    },
  ],
  sourceUrl: 'https://example.com/article',
  text: 'OpenAI launched infrastructure controls.',
  title: 'AI infrastructure controls',
};

test('normalizes valid structured output and drops unknown ids', () => {
  const result = validateArticleAnalysisResult(
    {
      axisLabelIds: ['label-1', 'unknown-label'],
      categoryIds: ['category-1', 'unknown-category'],
      entities: [
        {
          aliases: [' OpenAI, Inc. ', ''],
          confidence: 1.5,
          description: 'AI company',
          mentions: 2.8,
          name: ' OpenAI ',
          type: 'company',
        },
      ],
      importance: 'high',
      summary: ' Infrastructure controls expanded. ',
    },
    input,
  );

  assert.deepEqual(result.axisLabelIds, ['label-1']);
  assert.deepEqual(result.categoryIds, ['category-1']);
  assert.equal(result.entities[0].confidence, 1);
  assert.equal(result.entities[0].mentions, 2);
  assert.equal(result.entities[0].name, 'OpenAI');
  assert.equal(result.summary, 'Infrastructure controls expanded.');
});

test('rejects malformed structured output', () => {
  assert.throws(
    () =>
      validateArticleAnalysisResult(
        {
          axisLabelIds: [],
          categoryIds: [],
          entities: [],
          importance: 'urgent',
          summary: 'bad importance',
        },
        input,
      ),
    /importance has unsupported value/,
  );
});

test('normalizes digest summaries and rejects empty values', () => {
  assert.deepEqual(validateDigestSummaryResult({ summary: ' Digest ready. ' }), {
    summary: 'Digest ready.',
  });
  assert.throws(
    () => validateDigestSummaryResult({ summary: '   ' }),
    /summary must not be empty/,
  );
});
