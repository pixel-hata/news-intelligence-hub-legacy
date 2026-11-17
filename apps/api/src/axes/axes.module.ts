import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { AxesController } from './axes.controller';
import { AxesService } from './axes.service';

@Module({
  controllers: [AxesController],
  imports: [AuthModule],
  providers: [AxesService],
})
export class AxesModule {}
