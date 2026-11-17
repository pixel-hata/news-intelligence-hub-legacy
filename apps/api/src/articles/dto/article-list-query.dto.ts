import { IsIn, IsOptional, IsString } from 'class-validator';
import type { ArticleImportance, ArticleStatus } from '@nih/shared';

export type ArticlePeriod = '24h' | '7d' | '30d';

export class ArticleListQueryDto {
  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  feedId?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(['24h', '7d', '30d'])
  period?: ArticlePeriod;

  @IsOptional()
  @IsIn(['high', 'normal', 'junk'])
  importance?: ArticleImportance;

  @IsOptional()
  @IsIn(['discovered', 'filtered', 'queued', 'processing', 'processed', 'failed'])
  status?: ArticleStatus;
}
