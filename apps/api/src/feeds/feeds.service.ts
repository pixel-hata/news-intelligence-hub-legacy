import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { FeedStatus, FeedSummary } from '@nih/shared';

import { PrismaService } from '../database/prisma.service';
import { FeedPollingQueueService } from '../queues/feed-polling-queue.service';
import type { CreateFeedDto } from './dto/create-feed.dto';
import type { UpdateFeedDto } from './dto/update-feed.dto';

const feedStatusToDb = {
  active: 'ACTIVE',
  error: 'ERROR',
  paused: 'PAUSED',
} as const satisfies Record<FeedStatus, string>;

const feedStatusFromDb = {
  ACTIVE: 'active',
  ERROR: 'error',
  PAUSED: 'paused',
} as const;

interface FeedRecord {
  id: string;
  userId: string;
  title: string;
  url: string;
  status: keyof typeof feedStatusFromDb;
  pollingIntervalMinutes: number;
  lastPolledAt: Date | null;
  lastError: string | null;
}

interface PrismaUniqueError {
  code?: string;
}

@Injectable()
export class FeedsService {
  constructor(
    private readonly feedPollingQueue: FeedPollingQueueService,
    private readonly prisma: PrismaService,
  ) {}

  async list(userId: string): Promise<{ feeds: FeedSummary[] }> {
    const feeds = await this.prisma.feed.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      where: {
        userId,
      },
    });

    return {
      feeds: feeds.map((feed) => this.toSummary(feed)),
    };
  }

  async create(
    userId: string,
    dto: CreateFeedDto,
  ): Promise<{ feed: FeedSummary }> {
    const url = this.normalizeUrl(dto.url);
    await this.validateFeedUrl(url);

    try {
      const feed = await this.prisma.feed.create({
        data: {
          pollingIntervalMinutes: dto.pollingIntervalMinutes,
          title: dto.title.trim(),
          url,
          userId,
        },
      });

      await this.feedPollingQueue.enqueueFeedPoll({
        feedId: feed.id,
        requestedBy: 'manual',
        userId,
      });

      return {
        feed: this.toSummary(feed),
      };
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Feed URL already exists for this user');
      }
      throw error;
    }
  }

  async get(userId: string, id: string): Promise<{ feed: FeedSummary }> {
    const feed = await this.findOwnedFeed(userId, id);

    return {
      feed: this.toSummary(feed),
    };
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateFeedDto,
  ): Promise<{ feed: FeedSummary }> {
    await this.findOwnedFeed(userId, id);

    try {
      const feed = await this.prisma.feed.update({
        data: {
          pollingIntervalMinutes: dto.pollingIntervalMinutes,
          status: dto.status ? feedStatusToDb[dto.status] : undefined,
          title: dto.title?.trim(),
          url: dto.url ? this.normalizeUrl(dto.url) : undefined,
        },
        where: {
          id,
        },
      });

      return {
        feed: this.toSummary(feed),
      };
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Feed URL already exists for this user');
      }
      throw error;
    }
  }

  async remove(userId: string, id: string): Promise<{ ok: true }> {
    const result = await this.prisma.feed.deleteMany({
      where: {
        id,
        userId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Feed not found');
    }

    return { ok: true };
  }

  async requestPoll(
    userId: string,
    id: string,
  ): Promise<{ jobId?: string; ok: true }> {
    const feed = await this.findOwnedFeed(userId, id);

    if (feed.status === 'PAUSED') {
      throw new ConflictException('Paused feed cannot be polled');
    }

    const result = await this.feedPollingQueue.enqueueFeedPoll({
      feedId: feed.id,
      requestedBy: 'manual',
      userId,
    });

    return {
      jobId: result.jobId,
      ok: true,
    };
  }

  private async findOwnedFeed(
    userId: string,
    id: string,
  ): Promise<FeedRecord> {
    const feed = await this.prisma.feed.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!feed) {
      throw new NotFoundException('Feed not found');
    }

    return feed;
  }

  private normalizeUrl(url: string): string {
    let parsedUrl: URL;

    try {
      parsedUrl = new URL(url.trim());
    } catch {
      throw new BadRequestException('Feed URL must be a valid absolute URL');
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new BadRequestException('Feed URL must use http or https');
    }

    return parsedUrl.toString();
  }

  private async validateFeedUrl(url: string): Promise<void> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Number(process.env.FEED_CREATE_VALIDATE_TIMEOUT_MS || 5000),
    );

    try {
      const response = await fetch(url, {
        headers: {
          accept: 'application/atom+xml, application/rss+xml, application/xml, text/xml, */*',
          'user-agent': 'UA-Skills-News-Intelligence-Hub/1.0',
        },
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new BadRequestException(
          `Feed URL returned HTTP ${response.status}`,
        );
      }

      const body = await response.text();
      if (!/<(rss|feed)(\s|>|\/)/i.test(body.slice(0, 20000))) {
        throw new BadRequestException('Feed URL is not valid RSS/Atom XML');
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException('Feed URL is not reachable');
    } finally {
      clearTimeout(timeout);
    }
  }

  private isUniqueError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as PrismaUniqueError).code === 'P2002'
    );
  }

  private toSummary(feed: FeedRecord): FeedSummary {
    return {
      id: feed.id,
      lastError: feed.lastError ?? undefined,
      lastPolledAt: feed.lastPolledAt?.toISOString(),
      pollingIntervalMinutes: feed.pollingIntervalMinutes,
      status: feedStatusFromDb[feed.status],
      title: feed.title,
      url: feed.url,
      userId: feed.userId,
    };
  }
}
