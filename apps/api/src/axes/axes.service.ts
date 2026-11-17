import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  defaultLlmCostRates,
  estimateLlmCostUsd,
  parseLlmCostRate,
  queueNames,
} from '@nih/shared';
import type {
  AxisLabelSummary,
  CategorizationAxisSummary,
  RegenerationStatusSummary,
} from '@nih/shared';

import { PrismaService } from '../database/prisma.service';
import { BackgroundJobsService } from '../queues/background-jobs.service';
import type { AxisLabelDto } from './dto/axis-label.dto';
import type { CreateAxisDto } from './dto/create-axis.dto';
import type { UpdateAxisDto } from './dto/update-axis.dto';

interface AxisLabelRecord {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
}

interface AxisRecord {
  id: string;
  name: string;
  description: string | null;
  prompt: string;
  sortOrder: number;
  isActive: boolean;
  labels: AxisLabelRecord[];
}

interface PrismaUniqueError {
  code?: string;
}

type ArticleProgressKey =
  keyof RegenerationStatusSummary['articleProgress'];

@Injectable()
export class AxesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly backgroundJobs: BackgroundJobsService,
  ) {}

  async list(userId: string): Promise<{ axes: CategorizationAxisSummary[] }> {
    const axes = await this.prisma.categorizationAxis.findMany({
      include: this.includeLabels(),
      orderBy: {
        sortOrder: 'asc',
      },
      where: {
        userId,
      },
    });

    return {
      axes: axes.map((axis) => this.toSummary(axis)),
    };
  }

  async create(
    userId: string,
    dto: CreateAxisDto,
  ): Promise<{ axis: CategorizationAxisSummary }> {
    const labels = this.toLabelCreateInput(dto.labels ?? []);

    try {
      const axis = await this.prisma.categorizationAxis.create({
        data: {
          description: dto.description?.trim(),
          isActive: dto.isActive ?? true,
          labels: labels.length > 0 ? { create: labels } : undefined,
          name: dto.name.trim(),
          prompt: dto.prompt.trim(),
          sortOrder: dto.sortOrder ?? 0,
          userId,
        },
        include: this.includeLabels(),
      });

      return {
        axis: this.toSummary(axis),
      };
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Axis or label name already exists');
      }
      throw error;
    }
  }

  async get(
    userId: string,
    id: string,
  ): Promise<{ axis: CategorizationAxisSummary }> {
    const axis = await this.findOwnedAxis(userId, id);

    return {
      axis: this.toSummary(axis),
    };
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateAxisDto,
  ): Promise<{ axis: CategorizationAxisSummary }> {
    await this.findOwnedAxis(userId, id);

    try {
      const axis = await this.prisma.$transaction(async (tx) => {
        await tx.categorizationAxis.update({
          data: {
            description: dto.description?.trim(),
            isActive: dto.isActive,
            name: dto.name?.trim(),
            prompt: dto.prompt?.trim(),
            sortOrder: dto.sortOrder,
          },
          where: {
            id,
          },
        });

        if (dto.labels) {
          const labels = this.toLabelCreateInput(dto.labels);

          await tx.axisLabel.deleteMany({
            where: {
              axisId: id,
            },
          });
          if (labels.length > 0) {
            await tx.axisLabel.createMany({
              data: labels.map((label) => ({
                ...label,
                axisId: id,
              })),
            });
          }
        }

        return tx.categorizationAxis.findUniqueOrThrow({
          include: this.includeLabels(),
          where: {
            id,
          },
        });
      });

      return {
        axis: this.toSummary(axis),
      };
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Axis or label name already exists');
      }
      throw error;
    }
  }

  async remove(userId: string, id: string): Promise<{ ok: true }> {
    const result = await this.prisma.categorizationAxis.deleteMany({
      where: {
        id,
        userId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Axis not found');
    }

    return { ok: true };
  }

  async regenerate(userId: string): Promise<{
    articleCount: number;
    jobId?: string;
    queued: true;
  }> {
    const articleCount = await this.prisma.article.count({
      where: {
        status: 'PROCESSED',
        userId,
      },
    });

    const { jobId } = await this.backgroundJobs.enqueueAxisRegeneration({
      requestedBy: 'settings',
      userId,
    });

    return {
      articleCount,
      jobId,
      queued: true,
    };
  }

  async regenerationStatus(
    userId: string,
  ): Promise<RegenerationStatusSummary> {
    const [latestJob, articleStatusCounts] = await Promise.all([
      this.prisma.queueJobLog.findFirst({
        orderBy: {
          createdAt: 'desc',
        },
        where: {
          queueName: queueNames.axisRegeneration,
          userId,
        },
      }),
      this.prisma.article.groupBy({
        _count: {
          _all: true,
        },
        by: ['status'],
        where: {
          userId,
        },
      }),
    ]);

    const articleProgress: RegenerationStatusSummary['articleProgress'] = {
      discovered: 0,
      failed: 0,
      filtered: 0,
      processed: 0,
      processing: 0,
      queued: 0,
      total: 0,
    };

    for (const statusCount of articleStatusCounts) {
      const key = statusCount.status.toLowerCase() as ArticleProgressKey;
      if (key !== 'total') {
        articleProgress[key] = statusCount._count._all;
        articleProgress.total += statusCount._count._all;
      }
    }

    const since = latestJob?.startedAt ?? latestJob?.createdAt;
    const llmCalls = since
      ? await this.prisma.llmCall.findMany({
          select: {
            completionTokens: true,
            estimatedCostUsd: true,
            promptTokens: true,
            totalTokens: true,
          },
          where: {
            createdAt: {
              gte: since,
            },
            task: 'article-analysis',
            userId,
          },
        })
      : [];

    return {
      articleProgress,
      latestJob: latestJob
        ? {
            attempts: latestJob.attempts,
            error: latestJob.error ?? undefined,
            finishedAt: latestJob.finishedAt?.toISOString(),
            jobId: latestJob.jobId ?? undefined,
            startedAt: latestJob.startedAt?.toISOString(),
            status: latestJob.status,
          }
        : undefined,
      llmCost: {
        callCount: llmCalls.length,
        estimatedCostUsd: llmCalls.reduce(
          (sum, call) => sum + llmCallCostUsd(call),
          0,
        ),
        since: since?.toISOString(),
        totalTokens: llmCalls.reduce(
          (sum, call) => sum + call.totalTokens,
          0,
        ),
      },
    };
  }

  private async findOwnedAxis(
    userId: string,
    id: string,
  ): Promise<AxisRecord> {
    const axis = await this.prisma.categorizationAxis.findFirst({
      include: this.includeLabels(),
      where: {
        id,
        userId,
      },
    });

    if (!axis) {
      throw new NotFoundException('Axis not found');
    }

    return axis;
  }

  private includeLabels() {
    return {
      labels: {
        orderBy: {
          sortOrder: 'asc' as const,
        },
      },
    };
  }

  private toLabelCreateInput(labels: AxisLabelDto[]) {
    return labels.map((label, index) => ({
      description: label.description?.trim(),
      name: label.name.trim(),
      sortOrder: label.sortOrder ?? (index + 1) * 10,
    }));
  }

  private isUniqueError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as PrismaUniqueError).code === 'P2002'
    );
  }

  private toSummary(axis: AxisRecord): CategorizationAxisSummary {
    return {
      description: axis.description ?? undefined,
      id: axis.id,
      isActive: axis.isActive,
      labels: axis.labels.map((label) => this.toLabelSummary(label)),
      name: axis.name,
      prompt: axis.prompt,
      sortOrder: axis.sortOrder,
    };
  }

  private toLabelSummary(label: AxisLabelRecord): AxisLabelSummary {
    return {
      description: label.description ?? undefined,
      id: label.id,
      name: label.name,
      sortOrder: label.sortOrder,
    };
  }
}

function llmCallCostUsd(call: {
  completionTokens: number;
  estimatedCostUsd: unknown;
  promptTokens: number;
}): number {
  const storedCost = Number(call.estimatedCostUsd ?? 0);
  if (storedCost > 0) {
    return storedCost;
  }

  return estimateLlmCostUsd(
    {
      completionTokens: call.completionTokens,
      promptTokens: call.promptTokens,
    },
    llmCostRatesFromEnv(),
  );
}

function llmCostRatesFromEnv() {
  return {
    completionUsdPerMillionTokens: parseLlmCostRate(
      process.env.LLM_COMPLETION_COST_USD_PER_1M_TOKENS,
      defaultLlmCostRates.completionUsdPerMillionTokens,
    ),
    promptUsdPerMillionTokens: parseLlmCostRate(
      process.env.LLM_PROMPT_COST_USD_PER_1M_TOKENS,
      defaultLlmCostRates.promptUsdPerMillionTokens,
    ),
  };
}
