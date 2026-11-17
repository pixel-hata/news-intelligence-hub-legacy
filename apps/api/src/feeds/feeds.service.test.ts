import { BadRequestException, NotFoundException } from '@nestjs/common';
import assert from 'node:assert/strict';
import test from 'node:test';

import type { PrismaService } from '../database/prisma.service';
import type { FeedPollingQueueService } from '../queues/feed-polling-queue.service';
import { FeedsService } from './feeds.service';

interface FeedFindFirstInput {
  where: {
    id: string;
    userId: string;
  };
}

test('does not enqueue manual polling for a feed owned by another user', async () => {
  const state: {
    findFirstInput?: FeedFindFirstInput;
  } = {};
  let enqueueCalls = 0;
  const service = new FeedsService(
    {
      enqueueFeedPoll: async () => {
        enqueueCalls += 1;
        return {
          jobId: 'job-1',
        };
      },
    } as unknown as FeedPollingQueueService,
    {
      feed: {
        findFirst: async (input: FeedFindFirstInput) => {
          state.findFirstInput = input;
          return null;
        },
      },
    } as unknown as PrismaService,
  );

  await assert.rejects(
    () => service.requestPoll('user-2', 'feed-owned-by-user-1'),
    NotFoundException,
  );
  assert.deepEqual(state.findFirstInput?.where, {
    id: 'feed-owned-by-user-1',
    userId: 'user-2',
  });
  assert.equal(enqueueCalls, 0);
});

test('delete uses a scoped deleteMany instead of deleting by global id', async () => {
  let deleteManyWhere: FeedFindFirstInput['where'] | null = null;
  const service = new FeedsService(
    {} as FeedPollingQueueService,
    {
      feed: {
        deleteMany: async (input: { where: FeedFindFirstInput['where'] }) => {
          deleteManyWhere = input.where;
          return {
            count: 1,
          };
        },
      },
    } as unknown as PrismaService,
  );

  await service.remove('user-1', 'feed-1');

  assert.deepEqual(deleteManyWhere, {
    id: 'feed-1',
    userId: 'user-1',
  });
});

test('queues an immediate poll after creating a feed', async () => {
  let enqueueInput: unknown;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    ({
      ok: true,
      text: async () => '<rss><channel><item><title>Item</title><link>https://example.com/a</link></item></channel></rss>',
    }) as Response;
  const service = new FeedsService(
    {
      enqueueFeedPoll: async (input: unknown) => {
        enqueueInput = input;
        return {
          jobId: 'job-created',
        };
      },
    } as unknown as FeedPollingQueueService,
    {
      feed: {
        create: async () => ({
          id: 'feed-1',
          lastError: null,
          lastPolledAt: null,
          pollingIntervalMinutes: 30,
          status: 'ACTIVE',
          title: 'Created feed',
          url: 'https://example.com/rss.xml',
          userId: 'user-1',
        }),
      },
    } as unknown as PrismaService,
  );

  try {
    const result = await service.create('user-1', {
      pollingIntervalMinutes: 30,
      title: 'Created feed',
      url: 'https://example.com/rss.xml',
    });

    assert.equal(result.feed.id, 'feed-1');
    assert.deepEqual(enqueueInput, {
      feedId: 'feed-1',
      requestedBy: 'manual',
      userId: 'user-1',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects non-http feed URLs before writing or queueing', async () => {
  let createCalls = 0;
  let enqueueCalls = 0;
  const service = new FeedsService(
    {
      enqueueFeedPoll: async () => {
        enqueueCalls += 1;
        return {
          jobId: 'job-created',
        };
      },
    } as unknown as FeedPollingQueueService,
    {
      feed: {
        create: async () => {
          createCalls += 1;
          return {};
        },
      },
    } as unknown as PrismaService,
  );

  await assert.rejects(
    () =>
      service.create('user-1', {
        title: 'FTP feed',
        url: 'ftp://example.com/feed.xml',
      }),
    BadRequestException,
  );
  assert.equal(createCalls, 0);
  assert.equal(enqueueCalls, 0);
});

test('rejects reachable non-RSS URLs before writing or queueing', async () => {
  const originalFetch = globalThis.fetch;
  let createCalls = 0;
  let enqueueCalls = 0;
  globalThis.fetch = async () =>
    ({
      ok: true,
      text: async () => '<html><body>Not a feed</body></html>',
    }) as Response;
  const service = new FeedsService(
    {
      enqueueFeedPoll: async () => {
        enqueueCalls += 1;
        return {
          jobId: 'job-created',
        };
      },
    } as unknown as FeedPollingQueueService,
    {
      feed: {
        create: async () => {
          createCalls += 1;
          return {};
        },
      },
    } as unknown as PrismaService,
  );

  try {
    await assert.rejects(
      () =>
        service.create('user-1', {
          title: 'HTML page',
          url: 'https://example.com/',
        }),
      BadRequestException,
    );
    assert.equal(createCalls, 0);
    assert.equal(enqueueCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
