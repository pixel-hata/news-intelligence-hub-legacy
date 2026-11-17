import { Controller, Get } from '@nestjs/common';

interface HealthResponse {
  service: string;
  status: 'ok';
  timestamp: string;
  dependencies: {
    databaseConfigured: boolean;
    redisConfigured: boolean;
    llmProvider: string;
  };
}

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): HealthResponse {
    return {
      service: 'news-intelligence-api',
      status: 'ok',
      timestamp: new Date().toISOString(),
      dependencies: {
        databaseConfigured: Boolean(process.env.DATABASE_URL),
        redisConfigured: Boolean(process.env.REDIS_URL),
        llmProvider: process.env.LLM_PROVIDER || 'mock',
      },
    };
  }
}
