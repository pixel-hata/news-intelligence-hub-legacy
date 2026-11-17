import type {
  ArticleAnalysisEntity,
  ArticleAnalysisInput,
  ArticleAnalysisResult,
  DigestSummaryResult,
} from './types';

const importanceValues = ['high', 'normal', 'junk'] as const;
const entityTypeValues = [
  'person',
  'company',
  'product',
  'technology',
  'location',
  'topic',
  'other',
] as const;

export const articleAnalysisJsonSchema = {
  additionalProperties: false,
  properties: {
    axisLabelIds: {
      items: {
        type: 'string',
      },
      type: 'array',
    },
    categoryIds: {
      items: {
        type: 'string',
      },
      type: 'array',
    },
    entities: {
      items: {
        additionalProperties: false,
        properties: {
          aliases: {
            items: {
              type: 'string',
            },
            type: 'array',
          },
          confidence: {
            maximum: 1,
            minimum: 0,
            type: 'number',
          },
          description: {
            type: ['string', 'null'],
          },
          mentions: {
            minimum: 1,
            type: 'integer',
          },
          name: {
            type: 'string',
          },
          type: {
            enum: entityTypeValues,
            type: 'string',
          },
        },
        required: [
          'aliases',
          'confidence',
          'description',
          'mentions',
          'name',
          'type',
        ],
        type: 'object',
      },
      type: 'array',
    },
    importance: {
      enum: importanceValues,
      type: 'string',
    },
    summary: {
      type: 'string',
    },
  },
  required: ['axisLabelIds', 'categoryIds', 'entities', 'importance', 'summary'],
  type: 'object',
} as const;

export const digestSummaryJsonSchema = {
  additionalProperties: false,
  properties: {
    summary: {
      type: 'string',
    },
  },
  required: ['summary'],
  type: 'object',
} as const;

export function validateArticleAnalysisResult(
  value: unknown,
  input: ArticleAnalysisInput,
): ArticleAnalysisResult {
  if (!isRecord(value)) {
    throw new Error('LLM result must be an object');
  }

  const summary = requireString(value.summary, 'summary').slice(0, 4000);
  const importance = requireEnum(value.importance, importanceValues, 'importance');
  const allowedCategoryIds = new Set(input.categories.map((category) => category.id));
  const allowedAxisLabelIds = new Set(
    input.axes.flatMap((axis) => axis.labels.map((label) => label.id)),
  );

  return {
    axisLabelIds: requireStringArray(value.axisLabelIds, 'axisLabelIds').filter(
      (id) => allowedAxisLabelIds.has(id),
    ),
    categoryIds: requireStringArray(value.categoryIds, 'categoryIds').filter(
      (id) => allowedCategoryIds.has(id),
    ),
    entities: requireArray(value.entities, 'entities')
      .map((entity) => normalizeEntity(entity))
      .filter((entity) => entity.name.length > 0),
    importance,
    summary,
  };
}

export function validateDigestSummaryResult(value: unknown): DigestSummaryResult {
  if (!isRecord(value)) {
    throw new Error('LLM digest result must be an object');
  }

  const summary = requireString(value.summary, 'summary').slice(0, 4000);
  if (!summary) {
    throw new Error('LLM digest result field summary must not be empty');
  }

  return {
    summary,
  };
}

function normalizeEntity(value: unknown): ArticleAnalysisEntity {
  if (!isRecord(value)) {
    throw new Error('entity must be an object');
  }

  return {
    aliases: requireStringArray(value.aliases, 'entity.aliases')
      .map((alias) => alias.trim())
      .filter(Boolean)
      .slice(0, 12),
    confidence: clampNumber(value.confidence, 'entity.confidence'),
    description: nullableString(value.description, 'entity.description'),
    mentions: Math.max(1, Math.floor(requireNumber(value.mentions, 'entity.mentions'))),
    name: requireString(value.name, 'entity.name').trim().slice(0, 180),
    type: requireEnum(value.type, entityTypeValues, 'entity.type'),
  };
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string') {
    throw new Error(`LLM result field ${field} must be a string`);
  }

  return value.trim();
}

function nullableString(value: unknown, field: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return requireString(value, field) || null;
}

function requireStringArray(value: unknown, field: string): string[] {
  return requireArray(value, field).map((item) => requireString(item, field));
}

function requireArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`LLM result field ${field} must be an array`);
  }

  return value;
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(`LLM result field ${field} must be a number`);
  }

  return value;
}

function clampNumber(value: unknown, field: string): number {
  return Math.max(0, Math.min(1, requireNumber(value, field)));
}

function requireEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`LLM result field ${field} has unsupported value`);
  }

  return value as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
