import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type { FeedStatus } from '@nih/shared';

import { feedUrlValidationOptions } from './feed-url-validation-options';

export class UpdateFeedDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  title?: string;

  @IsOptional()
  @IsUrl(feedUrlValidationOptions)
  url?: string;

  @IsOptional()
  @IsIn(['active', 'paused', 'error'])
  status?: FeedStatus;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  pollingIntervalMinutes?: number;
}
