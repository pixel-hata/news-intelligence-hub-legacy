import { cleanEntityCandidateName, isLikelyNamedEntityName } from '@nih/shared';
import type {
  ArticleAnalysisInput,
  DigestSummaryInput,
  LlmAdapter,
  LlmAnalysisResponse,
  LlmDigestResponse,
} from './types';

export class MockLlmAdapter implements LlmAdapter {
  readonly model = 'mock-local-analysis';
  readonly provider = 'mock';

  async analyzeArticle(
    input: ArticleAnalysisInput,
  ): Promise<LlmAnalysisResponse> {
    const startedAt = Date.now();
    const words = input.text.split(/\s+/).filter(Boolean);
    const entities = extractSimpleEntities(input.text).slice(0, 8);
    const summary = words.slice(0, 70).join(' ');
    const promptTokens = estimateTokens([
      input.title,
      input.sourceUrl,
      input.text,
      JSON.stringify(input.categories),
      JSON.stringify(input.axes),
    ].join('\n'));
    const completionTokens = estimateTokens(JSON.stringify({
      entities,
      summary,
    }));

    return {
      durationMs: Date.now() - startedAt,
      model: this.model,
      provider: this.provider,
      result: {
        axisLabelIds: input.axes
          .map((axis) => axis.labels[0]?.id)
          .filter((id): id is string => Boolean(id)),
        categoryIds: matchCategories(input),
        entities,
        importance: words.length > 900 ? 'high' : 'normal',
        summary,
      },
      usage: {
        completionTokens,
        promptTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  }

  async summarizeDigest(
    input: DigestSummaryInput,
  ): Promise<LlmDigestResponse> {
    const startedAt = Date.now();
    const summary = buildDigestSummary(input);
    const promptTokens = estimateTokens(JSON.stringify(input));
    const completionTokens = estimateTokens(summary);

    return {
      durationMs: Date.now() - startedAt,
      model: this.model,
      provider: this.provider,
      result: {
        summary,
      },
      usage: {
        completionTokens,
        promptTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  }
}

function estimateTokens(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4));
}

function matchCategories(input: ArticleAnalysisInput): string[] {
  const text = `${input.title}\n${input.text}\n${input.sourceUrl}`.toLowerCase();
  const matched = input.categories
    .filter((category) => categoryMatchesText(category, text))
    .map((category) => category.id);

  return matched.length > 0
    ? matched
    : input.categories
        .filter((category) => category.includeKeywords.length === 0)
        .slice(0, 1)
        .map((category) => category.id);
}

function categoryMatchesText(
  category: ArticleAnalysisInput['categories'][number],
  text: string,
): boolean {
  const excludeKeywords = category.excludeKeywords.map((keyword) =>
    keyword.toLowerCase(),
  );
  if (excludeKeywords.some((keyword) => keyword && text.includes(keyword))) {
    return false;
  }

  const includeKeywords = category.includeKeywords.map((keyword) =>
    keyword.toLowerCase(),
  );
  if (includeKeywords.length === 0) {
    return false;
  }

  return includeKeywords.some((keyword) => keyword && text.includes(keyword));
}

function extractSimpleEntities(text: string) {
  const seen = new Set<string>();
  const matches = text.match(/\b[A-Z][A-Za-z0-9&.-]{2,}(?:\s+[A-Z][A-Za-z0-9&.-]{2,})?\b/g) ?? [];

  return matches
    .map((name) => name.trim())
    .map(cleanEntityCandidateName)
    .filter(Boolean)
    .filter((name) => {
      if (!isLikelyNamedEntityName(name)) {
        return false;
      }
      if (seen.has(name.toLowerCase())) {
        return false;
      }
      seen.add(name.toLowerCase());
      return true;
    })
    .map((name) => ({
      aliases: [],
      confidence: 0.55,
      description: null,
      mentions: 1,
      name,
      type: 'other' as const,
    }));
}

function buildDigestSummary(input: DigestSummaryInput): string {
  if (input.articleCount === 0) {
    return `No processed articles were available for this ${input.periodLabel} digest${input.scopeLabel ? ` scoped to ${input.scopeLabel}` : ''}.`;
  }

  const category = input.topCategories[0]?.name ?? 'uncategorized activity';
  const entity = input.topEntities[0]?.name ?? 'tracked entities';
  const keyArticle = input.keyArticles[0]?.title;
  const scope = input.scopeLabel ? ` Scope: ${input.scopeLabel}.` : '';
  const lead = `${input.articleCount} processed articles include ${input.highImportanceCount} high-importance items.`;
  const focus = `Leading category: ${category}. Most mentioned entity: ${entity}.`;
  const article = keyArticle ? ` Key article: ${keyArticle}.` : '';

  return `${lead} ${focus}${article}${scope}`;
}
