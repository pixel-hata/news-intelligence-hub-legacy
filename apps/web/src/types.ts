import type {
  ArticleImportance,
  ArticleStatus,
  ArticleSummary,
  CategorizationAxisSummary,
  CategorySummary,
  DigestSummary,
  EntitySummary,
  FeedStatus,
  FeedSummary,
  GraphEdge,
  GraphNode,
  LlmTelemetrySummary,
  NewsGraph,
  RegenerationStatusSummary,
} from '@nih/shared';

export type {
  ArticleImportance,
  ArticleStatus,
  ArticleSummary,
  CategorizationAxisSummary,
  CategorySummary,
  DigestSummary,
  EntitySummary,
  FeedStatus,
  FeedSummary,
  GraphEdge,
  GraphNode,
  LlmTelemetrySummary,
  NewsGraph,
  RegenerationStatusSummary,
};

export type Tab = 'feed' | 'graph' | 'digests' | 'settings' | 'telemetry';
export type ArticlePeriodFilter = 'all' | '24h' | '7d' | '30d';
export type DigestPeriod = 'day' | 'week' | 'month';
export type GraphDisplayMode = 'clusters' | 'detail' | 'overview';
export type GraphNodeTypeFilter = 'all' | 'article' | 'entity';
export type GraphDisplayNode = Omit<GraphNode, 'type'> & {
  clusterKind?: 'article-category' | 'entity-type';
  memberIds?: string[];
  type: GraphNode['type'] | 'cluster';
};
export interface GraphDisplayGraph {
  edges: GraphEdge[];
  nodes: GraphDisplayNode[];
}
export type FlowNodeData = {
  accentColor: string;
  degree: number;
  graphNode: GraphDisplayNode;
  label: string;
  subtitle: string;
};
export type FlowEdgeData = { graphEdge: GraphEdge };
export type RegenerationRequest = {
  articleCount: number;
  jobId?: string;
  queued: true;
};
export type CategoryDraft = {
  description: string;
  excludeKeywords: string;
  includeKeywords: string;
  name: string;
  ruleText: string;
};
export interface AuthUser {
  id: string;
  email: string;
  displayName: string | null;
  emailConfirmed: boolean;
}
export interface AppData {
  articles: ArticleSummary[];
  axes: CategorizationAxisSummary[];
  categories: CategorySummary[];
  digests: DigestSummary[];
  entities: EntitySummary[];
  feeds: FeedSummary[];
  graph: NewsGraph;
  llmTelemetry: LlmTelemetrySummary;
}
export interface EntityDetail {
  activity: {
    count: number;
    date: string;
  }[];
  entity: EntitySummary;
  mentioningArticles: {
    id: string;
    publishedAt?: string;
    sourceUrl: string;
    title: string;
  }[];
  relatedEntities: {
    count: number;
    entity: EntitySummary;
  }[];
}
export interface ArticleDetail {
  article: ArticleSummary;
  similarArticles: ArticleSummary[];
}

export const articleImportanceOptions: ArticleImportance[] = ['high', 'normal', 'junk'];
export const articleStatusOptions: ArticleStatus[] = [
  'discovered',
  'filtered',
  'queued',
  'processing',
  'processed',
  'failed',
];
export const articlePeriodOptions: { label: string; value: ArticlePeriodFilter }[] = [
  { label: 'Будь-який час', value: 'all' },
  { label: 'Останні 24 год', value: '24h' },
  { label: 'Останні 7 днів', value: '7d' },
  { label: 'Останні 30 днів', value: '30d' },
];
