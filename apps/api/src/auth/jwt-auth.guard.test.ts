import assert from 'node:assert/strict';
import test from 'node:test';

import { UnauthorizedException } from '@nestjs/common';

import { JwtAuthGuard } from './jwt-auth.guard';

interface TestRequest {
  headers: {
    authorization: string;
  };
  user?: {
    email: string;
    id: string;
  };
}

test('rejects a bearer token after the session version changes', async () => {
  const request: TestRequest = {
    headers: {
      authorization: 'Bearer token',
    },
  };
  const guard = new JwtAuthGuard(
    {
      verifyAsync: async () => ({
        email: 'demo@example.com',
        sessionVersion: 1,
        sub: 'user-1',
      }),
    } as never,
    {
      user: {
        findUnique: async () => ({
          emailConfirmedAt: new Date(),
          sessionVersion: 2,
        }),
      },
    } as never,
  );

  await assert.rejects(
    () => guard.canActivate(contextForRequest(request)),
    UnauthorizedException,
  );
});

test('accepts a bearer token with the current session version', async () => {
  const request: TestRequest = {
    headers: {
      authorization: 'Bearer token',
    },
  };
  const guard = new JwtAuthGuard(
    {
      verifyAsync: async () => ({
        email: 'demo@example.com',
        sessionVersion: 2,
        sub: 'user-1',
      }),
    } as never,
    {
      user: {
        findUnique: async () => ({
          emailConfirmedAt: new Date(),
          sessionVersion: 2,
        }),
      },
    } as never,
  );

  assert.equal(await guard.canActivate(contextForRequest(request)), true);
  assert.deepEqual(request.user, {
    email: 'demo@example.com',
    id: 'user-1',
  });
});

function contextForRequest(request: unknown) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as never;
}
