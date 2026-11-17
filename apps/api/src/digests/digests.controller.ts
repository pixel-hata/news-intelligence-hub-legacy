import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DigestsService } from './digests.service';
import { GenerateDigestDto } from './dto/generate-digest.dto';

@Controller('digests')
@UseGuards(JwtAuthGuard)
export class DigestsController {
  constructor(private readonly digestsService: DigestsService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.digestsService.list(user.id);
  }

  @Post('generate')
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateDigestDto,
  ) {
    return this.digestsService.generate(user.id, dto);
  }
}
