import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ArticlesController } from './articles.controller';
import { ArticlesService } from './articles.service';

@Module({
  controllers: [ArticlesController],
  imports: [AuthModule],
  providers: [ArticlesService],
})
export class ArticlesModule {}
