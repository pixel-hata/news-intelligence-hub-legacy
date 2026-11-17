import {
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

import { feedUrlValidationOptions } from './feed-url-validation-options';

export class CreateFeedDto {
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  title!: string;

  @IsUrl(feedUrlValidationOptions)
  url!: string;

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(1440)
  pollingIntervalMinutes?: number;
}
