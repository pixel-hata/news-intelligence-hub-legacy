import type { ArticleAnalysisInput, DigestSummaryInput } from './types';

export function buildArticleAnalysisInstructions(): string {
  return [
    'Analyze one technical news article for a news intelligence graph.',
    'Return only structured data matching the provided schema.',
    'Use categoryIds and axisLabelIds only from the input lists.',
    'Category includeKeywords and excludeKeywords are deterministic user rules: include matching categories, and do not include a category when an exclude keyword matches.',
    'Extract named entities that matter to the article context.',
    'Prefer deterministic values from the input over speculation.',
    'If the article is promotional, thin, or low-value, set importance to junk.',
  ].join('\n');
}

export function buildArticleAnalysisPrompt(input: ArticleAnalysisInput): string {
  return JSON.stringify(
    {
      article: {
        id: input.articleId,
        sourceUrl: input.sourceUrl,
        text: input.text,
        title: input.title,
      },
      axes: input.axes,
      categories: input.categories,
      outputRules: {
        axisLabelIds: 'Use only label ids from axes.labels.',
        categoryIds: 'Use only ids from categories.',
        importance: 'One of high, normal, junk.',
      },
    },
    null,
    2,
  );
}

export function buildDigestSummaryInstructions(): string {
  return [
    'Write a concise intelligence digest summary from already processed articles.',
    'Use only the provided article summaries, categories, entities, and counts.',
    'Do not invent facts, prices, dates, or external context.',
    'Return only structured data matching the provided schema.',
  ].join('\n');
}

export function buildDigestSummaryPrompt(input: DigestSummaryInput): string {
  return JSON.stringify(
    {
      articleCount: input.articleCount,
      highImportanceCount: input.highImportanceCount,
      keyArticles: input.keyArticles,
      periodLabel: input.periodLabel,
      scopeLabel: input.scopeLabel,
      topCategories: input.topCategories,
      topEntities: input.topEntities,
      outputRules: {
        summary:
          'One compact paragraph. Mention top entities/categories and why the period matters.',
      },
    },
    null,
    2,
  );
}
