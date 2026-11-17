export type FeedStatus = 'active' | 'paused' | 'error';

export type ArticleStatus =
  | 'discovered'
  | 'filtered'
  | 'queued'
  | 'processing'
  | 'processed'
  | 'failed';

export type ArticleImportance = 'high' | 'normal' | 'junk';

export type EntityType =
  | 'person'
  | 'company'
  | 'product'
  | 'technology'
  | 'location'
  | 'topic'
  | 'other';

export type GraphNodeType = 'article' | 'entity';

export type GraphEdgeType =
  | 'mentions'
  | 'co_mention'
  | 'similar';

export type LlmProvider = 'mock' | 'openai' | 'anthropic';

export type QueueName =
  | 'feed-polling'
  | 'article-processing'
  | 'axis-regeneration'
  | 'digest-generation';

export const queueNames = {
  articleProcessing: 'article-processing',
  axisRegeneration: 'axis-regeneration',
  digestGeneration: 'digest-generation',
  feedPolling: 'feed-polling',
} as const satisfies Record<string, QueueName>;

export type FeedPollRequestedBy = 'manual' | 'schedule' | 'startup';

export interface PollFeedJobData {
  feedId: string;
  userId: string;
  requestedBy: FeedPollRequestedBy;
}

export interface PollActiveFeedsJobData {
  requestedBy: 'schedule' | 'startup';
}

export type ArticleProcessReason = 'feed_poll' | 'manual' | 'regeneration';

export interface ProcessArticleJobData {
  articleId: string;
  userId: string;
  reason: ArticleProcessReason;
}

export interface AxisRegenerationJobData {
  articleIds?: string[];
  requestedBy: 'manual' | 'settings';
  userId: string;
}

export interface RegenerationStatusSummary {
  articleProgress: {
    discovered: number;
    failed: number;
    filtered: number;
    processed: number;
    processing: number;
    queued: number;
    total: number;
  };
  latestJob?: {
    attempts: number;
    error?: string;
    finishedAt?: string;
    jobId?: string;
    startedAt?: string;
    status: string;
  };
  llmCost: {
    callCount: number;
    estimatedCostUsd: number;
    since?: string;
    totalTokens: number;
  };
}

export interface DigestGenerationJobData {
  categoryIds?: string[];
  entityIds?: string[];
  periodLabel: 'day' | 'week' | 'month' | 'custom';
  periodEnd: string;
  periodStart: string;
  requestedBy: 'manual';
  scopeHash: string;
  scopeLabel?: string;
  userId: string;
}

export interface LlmTelemetrySummary {
  byProvider: {
    callCount: number;
    estimatedCostUsd: number;
    provider: LlmProvider;
    totalTokens: number;
  }[];
  byTask: {
    callCount: number;
    estimatedCostUsd: number;
    task: string;
    totalTokens: number;
  }[];
  cacheHits: number;
  estimatedCostUsd: number;
  recentCalls: {
    cacheHit: boolean;
    createdAt: string;
    estimatedCostUsd: number;
    model: string;
    provider: LlmProvider;
    status: string;
    task: string;
    totalTokens: number;
  }[];
  totalCalls: number;
  totalTokens: number;
}

export interface FeedSummary {
  id: string;
  userId: string;
  title: string;
  url: string;
  status: FeedStatus;
  pollingIntervalMinutes: number;
  lastPolledAt?: string;
  lastError?: string;
}

export interface CategorySummary {
  id: string;
  name: string;
  description?: string;
  ruleText?: string;
  includeKeywords: string[];
  excludeKeywords: string[];
  color: string;
}

export interface AxisLabelSummary {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
}

export interface CategorizationAxisSummary {
  id: string;
  name: string;
  description?: string;
  prompt: string;
  sortOrder: number;
  isActive: boolean;
  labels: AxisLabelSummary[];
}

export interface EntitySummary {
  id: string;
  type: EntityType;
  name: string;
  aliases: string[];
  description?: string;
  mentionArticleIds?: string[];
  firstSeen?: number;
  lastSeen?: number;
}

export interface ArticleSummary {
  id: string;
  feedId?: string;
  title: string;
  sourceUrl: string;
  publishedAt?: string;
  summary?: string;
  status: ArticleStatus;
  importance?: ArticleImportance;
  categories: CategorySummary[];
  axisLabels: AxisLabelSummary[];
  entities: EntitySummary[];
  similarCount: number;
}

export interface GraphNode {
  id: string;
  type: GraphNodeType;
  label: string;
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: GraphEdgeType;
  weight: number;
  metadata?: Record<string, unknown>;
}

export interface NewsGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface DigestSummary {
  id: string;
  periodEnd: string;
  periodStart: string;
  summary: string;
  articleCount?: number;
  keyArticles?: {
    id: string;
    title: string;
  }[];
  scopeLabel?: string;
  title: string;
  topCategories?: {
    count: number;
    name: string;
  }[];
  topEntities?: {
    count: number;
    name: string;
  }[];
}
