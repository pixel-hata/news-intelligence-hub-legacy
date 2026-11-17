import type {
  ArticleImportance,
  EntityType,
  LlmProvider,
} from '@nih/shared';

export interface AnalysisCategoryInput {
  id: string;
  name: string;
  description?: string | null;
  ruleText?: string | null;
  includeKeywords: string[];
  excludeKeywords: string[];
}

export interface AnalysisAxisInput {
  id: string;
  name: string;
  description?: string | null;
  prompt: string;
  labels: AnalysisAxisLabelInput[];
}

export interface AnalysisAxisLabelInput {
  id: string;
  name: string;
  description?: string | null;
}

export interface ArticleAnalysisInput {
  articleId: string;
  categories: AnalysisCategoryInput[];
  axes: AnalysisAxisInput[];
  sourceUrl: string;
  text: string;
  title: string;
}

export interface ArticleAnalysisEntity {
  aliases: string[];
  confidence: number;
  description: string | null;
  mentions: number;
  name: string;
  type: EntityType;
}

export interface ArticleAnalysisResult {
  axisLabelIds: string[];
  categoryIds: string[];
  entities: ArticleAnalysisEntity[];
  importance: ArticleImportance;
  summary: string;
}

export interface DigestSummaryInput {
  articleCount: number;
  highImportanceCount: number;
  keyArticles: {
    importance: ArticleImportance | null;
    summary: string | null;
    title: string;
  }[];
  periodLabel: string;
  scopeLabel?: string | null;
  topCategories: {
    count: number;
    name: string;
  }[];
  topEntities: {
    count: number;
    name: string;
  }[];
}

export interface DigestSummaryResult {
  summary: string;
}

export interface LlmUsage {
  completionTokens: number;
  promptTokens: number;
  totalTokens: number;
}

export interface LlmAnalysisResponse {
  durationMs: number;
  model: string;
  provider: LlmProvider;
  result: ArticleAnalysisResult;
  usage: LlmUsage;
}

export interface LlmDigestResponse {
  durationMs: number;
  model: string;
  provider: LlmProvider;
  result: DigestSummaryResult;
  usage: LlmUsage;
}

export interface LlmAdapter {
  analyzeArticle(input: ArticleAnalysisInput): Promise<LlmAnalysisResponse>;
  model: string;
  provider: LlmProvider;
  summarizeDigest(input: DigestSummaryInput): Promise<LlmDigestResponse>;
}
