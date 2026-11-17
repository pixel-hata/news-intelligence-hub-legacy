import { Controller, Get } from '@nestjs/common';
import {
  seedAxisLabels,
  seedCategories,
  seedCategorizationAxes,
} from '@nih/shared';

interface SeedAxisLabelResponse {
  name: string;
  sortOrder: number;
}

interface SeedAxisResponse {
  name: string;
  description?: string;
  prompt: string;
  sortOrder: number;
  isActive: boolean;
  labels: SeedAxisLabelResponse[];
}

interface SeedMetadataResponse {
  categories: typeof seedCategories;
  axes: SeedAxisResponse[];
}

@Controller('meta')
export class MetaController {
  @Get('seeds')
  getSeeds(): SeedMetadataResponse {
    return {
      categories: seedCategories,
      axes: seedCategorizationAxes.map((axis) => ({
        ...axis,
        labels: (seedAxisLabels[axis.name] ?? []).map((name, index) => ({
          name,
          sortOrder: (index + 1) * 10,
        })),
      })),
    };
  }
}
