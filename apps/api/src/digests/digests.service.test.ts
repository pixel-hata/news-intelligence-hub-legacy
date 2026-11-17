import assert from 'node:assert/strict';
import test from 'node:test';

import type { PrismaService } from '../database/prisma.service';
import type { BackgroundJobsService } from '../queues/background-jobs.service';
import { DigestsService } from './digests.service';

test('generates a scoped digest job only for user-owned categories and entities', async () => {
  const state: {
    countWhere?: Record<string, unknown>;
    digestJob?: unknown;
  } = {};
  const service = new DigestsService(
    {
      article: {
        count: async (input: { where: Record<string, unknown> }) => {
          state.countWhere = input.where;
          return 2;
        },
      },
      category: {
        findMany: async () => [
          {
            id: 'category-1',
            name: 'AI Infra',
          },
        ],
      },
      entity: {
        findMany: async () => [
          {
            id: 'entity-1',
            name: 'OpenAI',
          },
        ],
      },
    } as unknown as PrismaService,
    {
      enqueueDigestGeneration: async (input: unknown) => {
        state.digestJob = input;
        return {
          jobId: 'digest-job-1',
        };
      },
    } as unknown as BackgroundJobsService,
  );

  const result = await service.generate('user-1', {
    categoryIds: ['category-1'],
    entityIds: ['entity-1'],
    period: 'week',
  });

  assert.equal(result.articleCount, 2);
  assert.equal(result.queued, true);
  assert.equal(state.countWhere?.userId, 'user-1');
  assert.deepEqual(state.countWhere?.status, {
    in: ['PROCESSED', 'PROCESSING', 'QUEUED'],
  });
  assert.deepEqual(state.countWhere?.OR, [
    {
      categories: {
        some: {
          categoryId: {
            in: ['category-1'],
          },
        },
      },
    },
    {
      entities: {
        some: {
          entityId: {
            in: ['entity-1'],
          },
        },
      },
    },
  ]);
  const digestJob = state.digestJob as {
    scopeHash?: string;
  };
  assert.match(String(digestJob.scopeHash), /^[a-f0-9]{24}$/);
  assert.deepEqual(
    {
      ...(state.digestJob as Record<string, unknown>),
      scopeHash: 'hash-redacted',
    },
    {
    categoryIds: ['category-1'],
    entityIds: ['entity-1'],
    periodLabel: 'week',
    periodEnd: result.periodEnd,
    periodStart: result.periodStart,
    requestedBy: 'manual',
    scopeHash: 'hash-redacted',
    scopeLabel: 'category:AI Infra, entity:OpenAI',
    userId: 'user-1',
    },
  );
});
