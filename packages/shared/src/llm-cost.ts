export interface LlmCostRates {
  completionUsdPerMillionTokens: number;
  promptUsdPerMillionTokens: number;
}

export interface LlmTokenUsage {
  completionTokens: number;
  promptTokens: number;
}

export const defaultLlmCostRates: LlmCostRates = {
  completionUsdPerMillionTokens: 0.6,
  promptUsdPerMillionTokens: 0.15,
};

export function estimateLlmCostUsd(
  usage: LlmTokenUsage,
  rates: LlmCostRates = defaultLlmCostRates,
): number {
  const promptCost =
    (Math.max(usage.promptTokens, 0) / 1_000_000) *
    rates.promptUsdPerMillionTokens;
  const completionCost =
    (Math.max(usage.completionTokens, 0) / 1_000_000) *
    rates.completionUsdPerMillionTokens;

  return roundUsd(promptCost + completionCost);
}

export function parseLlmCostRate(
  value: string | undefined,
  fallback: number,
): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
