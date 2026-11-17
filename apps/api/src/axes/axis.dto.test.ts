import assert from 'node:assert/strict';
import test from 'node:test';

import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateAxisDto } from './dto/create-axis.dto';

test('rejects whitespace-only axis and label names', async () => {
  const dto = plainToInstance(CreateAxisDto, {
    labels: [
      {
        name: '   ',
      },
    ],
    name: '   ',
    prompt: 'Classify this article by the requested axis.',
  });

  const errors = await validate(dto);
  assert.ok(errors.some((error) => error.property === 'name'));
  assert.ok(
    errors
      .find((error) => error.property === 'labels')
      ?.children?.[0]?.children?.some((error) => error.property === 'name'),
  );
});
