import type { LlmProvider } from '@nih/shared';

import type {
  ArticleAnalysisInput,
  DigestSummaryInput,
  LlmAdapter,
  LlmAnalysisResponse,
  LlmDigestResponse,
} from './types';
import { logError, logInfo } from '../observability/logger';

export class FailoverLlmAdapter implements LlmAdapter {
  readonly model: string;
  readonly provider: LlmProvider;

  constructor(private readonly adapters: LlmAdapter[]) {
    if (adapters.length === 0) {
      throw new Error('FailoverLlmAdapter requires at least one adapter');
    }

    this.model = adapters[0].model;
    this.provider = adapters[0].provider;
  }

  async analyzeArticle(
    input: ArticleAnalysisInput,
  ): Promise<LlmAnalysisResponse> {
    const errors: string[] = [];

    for (const [index, adapter] of this.adapters.entries()) {
      try {
        const response = await adapter.analyzeArticle(input);

        if (index > 0) {
          logInfo('llm.failover_succeeded', {
            articleId: input.articleId,
            fallbackModel: adapter.model,
            fallbackProvider: adapter.provider,
            primaryProvider: this.adapters[0].provider,
          });
        }

        return response;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${adapter.provider}:${message}`);
        logError('llm.adapter_failed', {
          articleId: input.articleId,
          error: message,
          model: adapter.model,
          provider: adapter.provider,
        });
      }
    }

    throw new Error(`All LLM adapters failed: ${errors.join(' | ')}`);
  }

  async summarizeDigest(
    input: DigestSummaryInput,
  ): Promise<LlmDigestResponse> {
    const errors: string[] = [];

    for (const [index, adapter] of this.adapters.entries()) {
      try {
        const response = await adapter.summarizeDigest(input);

        if (index > 0) {
          logInfo('llm.digest_failover_succeeded', {
            fallbackModel: adapter.model,
            fallbackProvider: adapter.provider,
            primaryProvider: this.adapters[0].provider,
          });
        }

        return response;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        errors.push(`${adapter.provider}:${message}`);
        logError('llm.digest_adapter_failed', {
          error: message,
          model: adapter.model,
          provider: adapter.provider,
        });
      }
    }

    throw new Error(`All LLM adapters failed: ${errors.join(' | ')}`);
  }
}
