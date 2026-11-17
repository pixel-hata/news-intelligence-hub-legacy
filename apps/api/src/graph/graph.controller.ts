import {
  BadRequestException,
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GraphService } from './graph.service';

@Controller('graph')
@UseGuards(JwtAuthGuard)
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

  @Get()
  getGraph(
    @CurrentUser() user: AuthenticatedUser,
    @Query('categoryId') categoryId?: string,
    @Query('from') from?: string,
    @Query('q') query?: string,
    @Query('to') to?: string,
  ) {
    const fromTs = parseUnixTimestamp(from, 'from');
    const toTs = parseUnixTimestamp(to, 'to');
    if (fromTs !== undefined && toTs !== undefined && fromTs > toTs) {
      throw new BadRequestException('from must be before or equal to to');
    }

    return this.graphService.getGraph(user.id, {
      categoryId,
      fromTs,
      query,
      toTs,
    });
  }
}

function parseUnixTimestamp(value: string | undefined, field: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new BadRequestException(`${field} must be a valid unix timestamp`);
  }

  return parsed;
}
