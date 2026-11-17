import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { EntitiesController } from './entities.controller';
import { EntitiesService } from './entities.service';

@Module({
  controllers: [EntitiesController],
  imports: [AuthModule],
  providers: [EntitiesService],
})
export class EntitiesModule {}
