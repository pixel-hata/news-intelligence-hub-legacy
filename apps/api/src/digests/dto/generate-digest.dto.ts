import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsDateString,
  IsInt,
  IsIn,
  IsArray,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class GenerateDigestDto {
  @IsOptional()
  @IsInt()
  @Max(31)
  @Min(1)
  @Type(() => Number)
  days?: number;

  @IsIn(['day', 'week', 'month'])
  @IsOptional()
  period?: 'day' | 'week' | 'month';

  @IsDateString()
  @IsOptional()
  periodEnd?: string;

  @IsDateString()
  @IsOptional()
  periodStart?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  categoryIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  entityIds?: string[];
}
