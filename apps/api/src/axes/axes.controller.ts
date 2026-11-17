import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/authenticated-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AxesService } from './axes.service';
import { CreateAxisDto } from './dto/create-axis.dto';
import { UpdateAxisDto } from './dto/update-axis.dto';

@Controller('axes')
@UseGuards(JwtAuthGuard)
export class AxesController {
  constructor(private readonly axesService: AxesService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.axesService.list(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAxisDto,
  ) {
    return this.axesService.create(user.id, dto);
  }

  @Post('regenerate')
  regenerate(@CurrentUser() user: AuthenticatedUser) {
    return this.axesService.regenerate(user.id);
  }

  @Get('regeneration-status')
  regenerationStatus(@CurrentUser() user: AuthenticatedUser) {
    return this.axesService.regenerationStatus(user.id);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.axesService.get(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateAxisDto,
  ) {
    return this.axesService.update(user.id, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.axesService.remove(user.id, id);
  }
}
