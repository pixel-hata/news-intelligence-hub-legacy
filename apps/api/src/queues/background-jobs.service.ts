import type { OnModuleDestroy } from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import { queueNames } from '@nih/shared';
import type {
  AxisRegenerationJobData,
  DigestGenerationJobData,
} from '@nih/shared';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

@Injectable()
export class BackgroundJobsService implements OnModuleDestroy {
  private readonly connection = new IORedis(
    process.env.REDIS_URL || 'redis://localhost:6379',
    {
      maxRetriesPerRequest: null,
    },
  );

  private readonly axisRegenerationQueue = new Queue<AxisRegenerationJobData>(
    queueNames.axisRegeneration,
    {
      connection: this.connection,
    },
  );

  private readonly digestGenerationQueue = new Queue<DigestGenerationJobData>(
    queueNames.digestGeneration,
    {
      connection: this.connection,
    },
  );

  async enqueueAxisRegeneration(
    data: AxisRegenerationJobData,
  ): Promise<{ jobId?: string }> {
    const job = await this.axisRegenerationQueue.add(
      'regenerate-user-articles',
      data,
      {
        attempts: 2,
        backoff: {
          delay: 5000,
          type: 'exponential',
        },
        jobId: `axis-regeneration-${safeJobId(data.userId)}-${Date.now()}`,
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    );

    return {
      jobId: job.id,
    };
  }

  async enqueueDigestGeneration(
    data: DigestGenerationJobData,
  ): Promise<{ jobId?: string }> {
    const job = await this.digestGenerationQueue.add(
      'generate-period-digest',
      data,
      {
        attempts: 2,
        backoff: {
          delay: 5000,
          type: 'exponential',
        },
        jobId: `digest-${safeJobId(data.userId)}-${safeJobId(
          data.periodStart,
        )}-${safeJobId(data.periodEnd)}-${safeJobId(data.scopeHash)}`,
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    );

    return {
      jobId: job.id,
    };
  }

  async onModuleDestroy(): Promise<void> {
    await this.axisRegenerationQueue.close();
    await this.digestGenerationQueue.close();
    await this.connection.quit();
  }
}

function safeJobId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-');
}
