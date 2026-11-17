import assert from 'node:assert/strict';
import test from 'node:test';

import { validate } from 'class-validator';

import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

test('rejects whitespace-only category names', async () => {
  const createDto = new CreateCategoryDto();
  createDto.name = '   ';

  const updateDto = new UpdateCategoryDto();
  updateDto.name = '\t';

  assert.equal((await validate(createDto)).length > 0, true);
  assert.equal((await validate(updateDto)).length > 0, true);
});

test('accepts trimmed non-empty category names', async () => {
  const createDto = new CreateCategoryDto();
  createDto.name = ' AI Infrastructure ';

  const updateDto = new UpdateCategoryDto();
  updateDto.name = ' DevTools ';

  assert.equal((await validate(createDto)).length, 0);
  assert.equal((await validate(updateDto)).length, 0);
});
