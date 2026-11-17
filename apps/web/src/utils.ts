import type {
  ArticleImportance,
  ArticlePeriodFilter,
  ArticleStatus,
  ArticleSummary,
  CategorizationAxisSummary,
  CategoryDraft,
  CategorySummary,
} from './types';

export function filterArticles(
  articles: ArticleSummary[],
  filters: {
    categoryId: string;
    feedId: string;
    importance: ArticleImportance | '';
    period: ArticlePeriodFilter;
    search: string;
    status: ArticleStatus | '';
  },
): ArticleSummary[] {
  const periodStart = getArticlePeriodStart(filters.period);
  const search = filters.search.trim().toLowerCase();

  return articles.filter((article) => {
    if (search && !articleMatchesSearch(article, search)) {
      return false;
    }

    if (
      filters.categoryId &&
      !article.categories.some((category) => category.id === filters.categoryId)
    ) {
      return false;
    }

    if (filters.feedId && article.feedId !== filters.feedId) {
      return false;
    }

    if (filters.importance && article.importance !== filters.importance) {
      return false;
    }

    if (filters.status && article.status !== filters.status) {
      return false;
    }

    if (periodStart !== null) {
      if (!article.publishedAt) {
        return false;
      }
      const publishedAt = new Date(article.publishedAt).getTime();
      if (Number.isNaN(publishedAt) || publishedAt < periodStart) {
        return false;
      }
    }

    return true;
  });
}

function articleMatchesSearch(article: ArticleSummary, search: string): boolean {
  const searchable = [
    article.title,
    article.summary ?? '',
    article.sourceUrl,
    ...article.categories.map((category) => category.name),
    ...article.axisLabels.map((label) => label.name),
    ...article.entities.flatMap((entity) => [
      entity.name,
      entity.type,
      entity.description ?? '',
      ...entity.aliases,
    ]),
  ].join(' ').toLowerCase();

  return searchable.includes(search);
}

export function getArticlePeriodStart(period: ArticlePeriodFilter): number | null {
  const now = Date.now();

  if (period === '24h') {
    return now - 24 * 60 * 60 * 1000;
  }
  if (period === '7d') {
    return now - 7 * 24 * 60 * 60 * 1000;
  }
  if (period === '30d') {
    return now - 30 * 24 * 60 * 60 * 1000;
  }

  return null;
}

export function topCounts(values: string[], limit = 5): { label: string; value: number }[] {
  const counts = new Map<string, number>();

  for (const value of values) {
    const label = value.trim();
    if (!label) {
      continue;
    }
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }));
}

export function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'некоректна дата';
  }

  return date.toLocaleDateString('uk-UA');
}

export function formatDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'некоректна дата';
  }

  return date.toLocaleString('uk-UA', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function startedAtFromJobId(jobId?: string): string | undefined {
  const timestamp = jobTimestamp(jobId);
  return timestamp ? new Date(timestamp).toISOString() : undefined;
}

export function shortJobReference(jobId?: string): string | undefined {
  if (!jobId) {
    return undefined;
  }

  const timestamp = jobTimestamp(jobId);
  const reference = timestamp ? String(timestamp) : jobId;
  return `#${reference.slice(-6)}`;
}

function jobTimestamp(jobId?: string): number | undefined {
  const match = jobId?.match(/-(\d{10,})$/);
  const timestamp = match ? Number(match[1]) : Number.NaN;

  return Number.isFinite(timestamp) ? timestamp : undefined;
}

export function formatMetadataValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === 'object' && item !== null
          ? JSON.stringify(item)
          : String(item),
      )
      .join(', ');
  }

  return String(value);
}

export function metadataString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

export function relatedArticlesFromMetadata(
  value: unknown,
): { id: string; publishedAt?: string; title: string }[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> =>
      typeof item === 'object' && item !== null,
    )
    .map((item) => ({
      id: typeof item.id === 'string' ? item.id : '',
      publishedAt: typeof item.publishedAt === 'string' ? item.publishedAt : undefined,
      title: typeof item.title === 'string' ? item.title : '',
    }))
    .filter((item) => item.id && item.title);
}

export function axisDraft(
  axis: CategorizationAxisSummary,
  drafts: Record<string, { labels: string; name: string }>,
): { labels: string; name: string } {
  return drafts[axis.id] ?? {
    labels: axis.labels.map((label) => label.name).join(', '),
    name: axis.name,
  };
}

export function categoryDraft(
  category: CategorySummary,
  drafts: Record<string, CategoryDraft>,
): CategoryDraft {
  return drafts[category.id] ?? {
    description: category.description ?? '',
    excludeKeywords: category.excludeKeywords.join(', '),
    includeKeywords: category.includeKeywords.join(', '),
    name: category.name,
    ruleText: category.ruleText ?? '',
  };
}

export function parseCsv(value: string): string[] {
  return [
    ...new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}
