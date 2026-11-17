import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { FeedsController } from './feeds.controller';
import { FeedsService } from './feeds.service';

@Module({
  controllers: [FeedsController],
  imports: [AuthModule],
  providers: [FeedsService],
})
export class FeedsModule {}
