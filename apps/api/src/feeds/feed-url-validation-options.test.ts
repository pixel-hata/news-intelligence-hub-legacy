import assert from 'node:assert/strict';
import test from 'node:test';
import { validate } from 'class-validator';

import { CreateFeedDto } from './dto/create-feed.dto';
import { UpdateFeedDto } from './dto/update-feed.dto';

test('feed DTO accepts absolute internal Docker host URLs', async () => {
  const createDto = Object.assign(new CreateFeedDto(), {
    title: 'Internal feed',
    url: 'http://nih-rss-stress:8099/feed/strict20/0.xml',
  });
  const updateDto = Object.assign(new UpdateFeedDto(), {
    url: 'http://nih-rss-stress:8099/feed/strict20/0.xml',
  });

  assert.equal((await validate(createDto)).length, 0);
  assert.equal((await validate(updateDto)).length, 0);
});

test('feed DTO still rejects relative feed URLs', async () => {
  const createDto = Object.assign(new CreateFeedDto(), {
    title: 'Relative feed',
    url: '/feed/strict20/0.xml',
  });

  const errors = await validate(createDto);

  assert.equal(errors.length, 1);
  assert.equal(errors[0]?.property, 'url');
});
