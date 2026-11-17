import { createHash } from 'node:crypto';

import type { ArticleAnalysisInput, LlmAdapter } from './types';

export function buildArticleAnalysisCacheKey(
  adapter: LlmAdapter,
  input: ArticleAnalysisInput,
  textContentHash: string | null,
): string {
  return hashStableJson({
    axes: input.axes.map((axis) => ({
      id: axis.id,
      labels: axis.labels.map((label) => label.id),
      prompt: axis.prompt,
    })),
    categories: input.categories.map((category) => category.id),
    model: adapter.model,
    provider: adapter.provider,
    task: 'article-analysis-v1',
    textContentHash,
  });
}

function hashStableJson(value: unknown): string {
  return createHash('sha256').update(stableStringify(value)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}
