import { Global, Module } from '@nestjs/common';

import { BackgroundJobsService } from './background-jobs.service';
import { FeedPollingQueueService } from './feed-polling-queue.service';

@Global()
@Module({
  exports: [BackgroundJobsService, FeedPollingQueueService],
  providers: [BackgroundJobsService, FeedPollingQueueService],
})
export class QueuesModule {}
