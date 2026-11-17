import { Module } from '@nestjs/common';

import { ArticlesModule } from './articles/articles.module';
import { AuthModule } from './auth/auth.module';
import { AxesModule } from './axes/axes.module';
import { CategoriesModule } from './categories/categories.module';
import { DatabaseModule } from './database/database.module';
import { DigestsModule } from './digests/digests.module';
import { EntitiesModule } from './entities/entities.module';
import { FeedsModule } from './feeds/feeds.module';
import { GraphModule } from './graph/graph.module';
import { HealthController } from './health.controller';
import { MetaModule } from './meta/meta.module';
import { QueuesModule } from './queues/queues.module';
import { TelemetryModule } from './telemetry/telemetry.module';

@Module({
  controllers: [HealthController],
  imports: [
    DatabaseModule,
    MetaModule,
    AuthModule,
    FeedsModule,
    CategoriesModule,
    AxesModule,
    QueuesModule,
    ArticlesModule,
    EntitiesModule,
    GraphModule,
    DigestsModule,
    TelemetryModule,
  ],
})
export class AppModule {}
