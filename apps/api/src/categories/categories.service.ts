import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { CategorySummary } from '@nih/shared';

import { PrismaService } from '../database/prisma.service';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { UpdateCategoryDto } from './dto/update-category.dto';

interface CategoryRecord {
  id: string;
  name: string;
  description: string | null;
  ruleText: string | null;
  includeKeywords: string[];
  excludeKeywords: string[];
  color: string;
}

interface PrismaUniqueError {
  code?: string;
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<{ categories: CategorySummary[] }> {
    const categories = await this.prisma.category.findMany({
      orderBy: {
        name: 'asc',
      },
      where: {
        userId,
      },
    });

    return {
      categories: categories.map((category) => this.toSummary(category)),
    };
  }

  async create(
    userId: string,
    dto: CreateCategoryDto,
  ): Promise<{ category: CategorySummary }> {
    try {
      const category = await this.prisma.category.create({
        data: {
          color: dto.color,
          description: dto.description?.trim(),
          excludeKeywords: normalizeKeywords(dto.excludeKeywords),
          includeKeywords: normalizeKeywords(dto.includeKeywords),
          name: dto.name.trim(),
          ruleText: dto.ruleText?.trim(),
          userId,
        },
      });

      return {
        category: this.toSummary(category),
      };
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Category name already exists');
      }
      throw error;
    }
  }

  async get(
    userId: string,
    id: string,
  ): Promise<{ category: CategorySummary }> {
    const category = await this.findOwnedCategory(userId, id);

    return {
      category: this.toSummary(category),
    };
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateCategoryDto,
  ): Promise<{ category: CategorySummary }> {
    await this.findOwnedCategory(userId, id);

    try {
      const category = await this.prisma.category.update({
        data: {
          color: dto.color,
          description: dto.description?.trim(),
          excludeKeywords:
            dto.excludeKeywords !== undefined
              ? normalizeKeywords(dto.excludeKeywords)
              : undefined,
          includeKeywords:
            dto.includeKeywords !== undefined
              ? normalizeKeywords(dto.includeKeywords)
              : undefined,
          name: dto.name?.trim(),
          ruleText: dto.ruleText?.trim(),
        },
        where: {
          id,
        },
      });

      return {
        category: this.toSummary(category),
      };
    } catch (error) {
      if (this.isUniqueError(error)) {
        throw new ConflictException('Category name already exists');
      }
      throw error;
    }
  }

  async remove(userId: string, id: string): Promise<{ ok: true }> {
    const result = await this.prisma.category.deleteMany({
      where: {
        id,
        userId,
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Category not found');
    }

    return { ok: true };
  }

  private async findOwnedCategory(
    userId: string,
    id: string,
  ): Promise<CategoryRecord> {
    const category = await this.prisma.category.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category;
  }

  private isUniqueError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      (error as PrismaUniqueError).code === 'P2002'
    );
  }

  private toSummary(category: CategoryRecord): CategorySummary {
    return {
      color: category.color,
      description: category.description ?? undefined,
      excludeKeywords: category.excludeKeywords,
      id: category.id,
      includeKeywords: category.includeKeywords,
      name: category.name,
      ruleText: category.ruleText ?? undefined,
    };
  }
}

function normalizeKeywords(values?: string[]): string[] {
  return [
    ...new Set(
      (values ?? [])
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 30),
    ),
  ];
}
