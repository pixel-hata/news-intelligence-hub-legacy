import assert from 'node:assert/strict';
import test from 'node:test';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { LoginDto } from './dto/login.dto';

test('normalizes copied email whitespace before validation', async () => {
  const dto = plainToInstance(LoginDto, {
    email: ' Demo@Example.COM ',
    password: 'demo-password',
  });

  const errors = await validate(dto);
  assert.equal(errors.length, 0);
  assert.equal(dto.email, 'demo@example.com');
});
