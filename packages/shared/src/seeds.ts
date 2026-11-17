import type { CategorizationAxisSummary, CategorySummary } from './domain';

export const seedCategories: Omit<CategorySummary, 'id'>[] = [
  {
    name: 'AI Infrastructure',
    description: 'Models, chips, cloud platforms, tooling, and deployment.',
    ruleText: 'Match infrastructure, model deployment, chips, cloud platforms, inference, and developer tooling.',
    includeKeywords: ['model', 'chip', 'cloud', 'inference', 'infrastructure', 'deployment', 'tooling'],
    excludeKeywords: [],
    color: '#2563eb',
  },
  {
    name: 'Product Launches',
    description: 'New products, releases, integrations, and public betas.',
    ruleText: 'Match launches, releases, integrations, betas, product announcements, and feature rollouts.',
    includeKeywords: ['launch', 'release', 'integration', 'beta', 'feature', 'rollout', 'introduced', 'announced'],
    excludeKeywords: [],
    color: '#059669',
  },
  {
    name: 'Market Signals',
    description: 'Funding, revenue, pricing, adoption, and competitive moves.',
    ruleText: 'Match funding, revenue, adoption, pricing, competition, market share, and strategic moves.',
    includeKeywords: ['funding', 'revenue', 'pricing', 'adoption', 'market', 'competitive', 'customers'],
    excludeKeywords: [],
    color: '#c2410c',
  },
  {
    name: 'Policy and Risk',
    description: 'Regulation, safety, security, governance, and legal risk.',
    ruleText: 'Match regulation, governance, security, safety, compliance, legal risk, and policy.',
    includeKeywords: ['regulation', 'governance', 'security', 'safety', 'compliance', 'legal', 'risk', 'policy'],
    excludeKeywords: [],
    color: '#7c3aed',
  },
];

export const seedCategorizationAxes: Omit<
  CategorizationAxisSummary,
  'id' | 'labels'
>[] = [
  {
    name: 'Business Impact',
    description: 'How much the article can affect product, market, or strategy.',
    prompt:
      'Classify business impact as low, medium, high, or critical for a technology decision maker.',
    sortOrder: 10,
    isActive: true,
  },
  {
    name: 'Time Sensitivity',
    description: 'How quickly a reader should react to this information.',
    prompt:
      'Classify time sensitivity as background, monitor, act this week, or urgent.',
    sortOrder: 20,
    isActive: true,
  },
  {
    name: 'Novelty',
    description: 'Whether the article repeats known context or adds new facts.',
    prompt:
      'Classify novelty as repeated, incremental, notable, or breakthrough.',
    sortOrder: 30,
    isActive: true,
  },
  {
    name: 'Confidence',
    description: 'How reliable the article appears based on source and evidence.',
    prompt:
      'Classify confidence as low, medium, high, or verified. Flag rumors carefully.',
    sortOrder: 40,
    isActive: true,
  },
];

export const seedAxisLabels: Record<string, string[]> = {
  'Business Impact': ['low', 'medium', 'high', 'critical'],
  'Time Sensitivity': ['background', 'monitor', 'act this week', 'urgent'],
  Novelty: ['repeated', 'incremental', 'notable', 'breakthrough'],
  Confidence: ['low', 'medium', 'high', 'verified'],
};
