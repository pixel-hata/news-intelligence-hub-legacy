import 'reflect-metadata';

import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Logger, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { queueNames } from '@nih/shared';
import { Queue } from 'bullmq';
import type { NextFunction, Request, Response } from 'express';
import IORedis from 'ioredis';

import { AppModule } from './app.module';
import {
  bullBoardQueueDisplayNames,
  injectBullBoardUkrainianHtml,
  sendBullBoardUkrainianLocale,
} from './queues/bull-board-ukrainian';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  const logger = new Logger('Bootstrap');
  const port = Number(process.env.API_PORT || 3000);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      forbidUnknownValues: true,
      transform: true,
      whitelist: true,
    }),
  );
  configureBullBoard(app);

  await app.listen(port, '0.0.0.0');
  logger.log(`API listening on port ${port}`);
}

void bootstrap();

function configureBullBoard(app: INestApplication): void {
  if (process.env.BULL_BOARD_ENABLED === 'false') {
    return;
  }

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  const connection = new IORedis(
    process.env.REDIS_URL || 'redis://localhost:6379',
    {
      maxRetriesPerRequest: null,
    },
  );
  const queues = [
    queueNames.feedPolling,
    queueNames.articleProcessing,
    queueNames.axisRegeneration,
    queueNames.digestGeneration,
  ].map((name) => new Queue(name, { connection }));

  createBullBoard({
    options: {
      uiConfig: {
        boardTitle: 'Панель черг',
        locale: {
          lng: 'en-US',
        },
        sortQueues: true,
      },
    },
    queues: queues.map(
      (queue) =>
        new BullMQAdapter(queue, {
          displayName: bullBoardQueueDisplayNames[queue.name] ?? queue.name,
        }),
    ),
    serverAdapter,
  });

  app.use(
    '/admin/queues/static/locales/:locale/messages.json',
    basicAuth,
    sendBullBoardUkrainianLocale,
  );
  app.use(
    '/admin/queues',
    basicAuth,
    injectBullBoardUkrainianHtml,
    serverAdapter.getRouter(),
  );
}

function basicAuth(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const expectedUser = process.env.BULL_BOARD_USER || 'admin';
  const expectedPassword = process.env.BULL_BOARD_PASSWORD || 'change-me';
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith('Basic ')) {
    rejectBasicAuth(response);
    return;
  }

  const decoded = Buffer.from(authorization.slice('Basic '.length), 'base64')
    .toString('utf8');
  const separatorIndex = decoded.indexOf(':');
  const username = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);

  if (username !== expectedUser || password !== expectedPassword) {
    rejectBasicAuth(response);
    return;
  }

  next();
}

function rejectBasicAuth(response: Response): void {
  response.setHeader('WWW-Authenticate', 'Basic realm="Монітор черг"');
  response.status(401).send('Потрібна автентифікація');
}
