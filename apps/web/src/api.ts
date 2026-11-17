import type {
  AppData,
  ArticleSummary,
  AuthUser,
  CategorizationAxisSummary,
  CategorySummary,
  DigestSummary,
  EntitySummary,
  FeedSummary,
  LlmTelemetrySummary,
  NewsGraph,
} from './types';

export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
export const queueMonitorUrl = apiBaseUrl.replace(/\/api\/?$/, '/admin/queues');
export const showQueueLink = import.meta.env.VITE_SHOW_QUEUE_LINK !== 'false';

export const emptyData: AppData = {
  articles: [],
  axes: [],
  categories: [],
  digests: [],
  entities: [],
  feeds: [],
  graph: {
    edges: [],
    nodes: [],
  },
  llmTelemetry: {
    byProvider: [],
    byTask: [],
    cacheHits: 0,
    estimatedCostUsd: 0,
    recentCalls: [],
    totalCalls: 0,
    totalTokens: 0,
  },
};

export async function refreshSession(
  token: string,
  setUser: (user: AuthUser | null) => void,
  setMessage: (message: string) => void,
) {
  try {
    const response = await apiFetch<{ user: AuthUser }>('/auth/me', { token });
    setUser(response.user);
  } catch (error) {
    localStorage.removeItem('nih_token');
    setUser(null);
    setMessage(error instanceof Error ? error.message : 'Сесія завершилася');
  }
}

export async function loadData(
  token: string,
  setData: (data: AppData) => void,
  setMessage: (message: string) => void,
) {
  try {
    const [feeds, categories, axes, articles, entities, graph, digests, llmTelemetry] = await Promise.all([
      apiFetch<{ feeds: FeedSummary[] }>('/feeds', { token }),
      apiFetch<{ categories: CategorySummary[] }>('/categories', { token }),
      apiFetch<{ axes: CategorizationAxisSummary[] }>('/axes', { token }),
      apiFetch<{ articles: ArticleSummary[] }>('/articles', { token }),
      apiFetch<{ entities: EntitySummary[] }>('/entities', { token }),
      apiFetch<{ graph: NewsGraph }>('/graph', { token }),
      apiFetch<{ digests: DigestSummary[] }>('/digests', { token }),
      apiFetch<{ llm: LlmTelemetrySummary }>('/telemetry/llm', { token }),
    ]);

    setData({
      articles: articles.articles,
      axes: axes.axes,
      categories: categories.categories,
      digests: digests.digests,
      entities: entities.entities,
      feeds: feeds.feeds,
      graph: graph.graph,
      llmTelemetry: llmTelemetry.llm,
    });
    setMessage('');
  } catch (error) {
    setMessage(error instanceof Error ? error.message : 'Не вдалося завантажити дані');
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('content-type', 'application/json');
  if (options.token) {
    headers.set('authorization', `Bearer ${options.token}`);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(await responseErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

async function responseErrorMessage(response: Response): Promise<string> {
  const text = await response.text();

  try {
    const payload = JSON.parse(text) as { message?: unknown };
    if (typeof payload.message === 'string') {
      return payload.message;
    }
    if (Array.isArray(payload.message)) {
      return payload.message.filter((item) => typeof item === 'string').join(', ');
    }
  } catch {
    // Fall through to the raw text below.
  }

  return text ? `API ${response.status}: ${text}` : `API ${response.status}`;
}
