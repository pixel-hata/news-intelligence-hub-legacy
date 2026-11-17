import assert from 'node:assert/strict';
import test from 'node:test';

import { BadRequestException } from '@nestjs/common';

import { GraphController } from './graph.controller';

test('rejects invalid graph timestamp filters', () => {
  const controller = new GraphController({} as never);

  assert.throws(
    () =>
      controller.getGraph(
        {
          email: 'demo@example.com',
          id: 'user-1',
        },
        undefined,
        'abc',
        undefined,
        '123',
      ),
    BadRequestException,
  );
  assert.throws(
    () =>
      controller.getGraph(
        {
          email: 'demo@example.com',
          id: 'user-1',
        },
        undefined,
        '200',
        undefined,
        '100',
      ),
    BadRequestException,
  );
});
