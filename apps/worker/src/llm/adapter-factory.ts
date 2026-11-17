import type { LlmProvider } from '@nih/shared';

import { AnthropicAdapter } from './anthropic-adapter';
import { FailoverLlmAdapter } from './failover-adapter';
import type { LlmAdapter } from './types';
import { MockLlmAdapter } from './mock-adapter';
import { OpenAiAdapter } from './openai-adapter';

export function createLlmAdapter(): LlmAdapter {
  const provider = (process.env.LLM_PROVIDER || 'mock').toLowerCase() as LlmProvider;
  const primary = createProviderAdapter(provider);
  const fallbackAdapters = parseFallbackProviders()
    .filter((fallbackProvider) => fallbackProvider !== provider)
    .map((fallbackProvider) => createProviderAdapter(fallbackProvider));

  if (!isFailoverEnabled() || fallbackAdapters.length === 0) {
    return primary;
  }

  return new FailoverLlmAdapter([primary, ...fallbackAdapters]);
}

function createProviderAdapter(provider: LlmProvider): LlmAdapter {
  if (provider === 'openai') {
    return new OpenAiAdapter();
  }
  if (provider === 'anthropic') {
    return new AnthropicAdapter();
  }

  return new MockLlmAdapter();
}

function isFailoverEnabled(): boolean {
  return ['1', 'true', 'yes'].includes(
    (process.env.LLM_FAILOVER_ENABLED || '').toLowerCase(),
  );
}

function parseFallbackProviders(): LlmProvider[] {
  return (process.env.LLM_FALLBACK_PROVIDERS || '')
    .split(',')
    .map((provider) => provider.trim().toLowerCase())
    .filter((provider): provider is LlmProvider =>
      ['anthropic', 'mock', 'openai'].includes(provider),
    );
}
