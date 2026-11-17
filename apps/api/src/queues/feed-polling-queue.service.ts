import type { OnModuleDestroy } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { queueNames } from '@nih/shared';
import type { PollActiveFeedsJobData, PollFeedJobData } from '@nih/shared';

@Injectable()
export class FeedPollingQueueService implements OnModuleDestroy {
  private readonly connection = new IORedis(
    process.env.REDIS_URL || 'redis://localhost:6379',
    {
      maxRetriesPerRequest: null,
    },
  );

  private readonly queue = new Queue<
    PollFeedJobData | PollActiveFeedsJobData
  >(queueNames.feedPolling, {
    connection: this.connection,
  });

  async enqueueFeedPoll(data: PollFeedJobData): Promise<{ jobId?: string }> {
    const job = await this.queue.add('poll-feed', data, {
      attempts: 3,
      backoff: {
        delay: 5000,
        type: 'exponential',
      },
      jobId: `feed-${data.feedId}-${Date.now()}`,
      removeOnComplete: 200,
      removeOnFail: 500,
    });

    return {
      jobId: job.id,
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    await this.connection.quit();
  }
}
