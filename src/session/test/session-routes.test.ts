import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  SessionCommandResult,
  SessionErrorCode,
} from '../session-types.js';

vi.mock('../session-service.js', () => ({
  loginSession: vi.fn(),
  getCurrentSession: vi.fn(),
  logoutSession: vi.fn(),
}));

const { loginSession, getCurrentSession, logoutSession } =
  await import('../session-service.js');
const { sessionRouter } = await import('../session-routes.js');

const mockedLoginSession = vi.mocked(loginSession);
const mockedGetCurrentSession = vi.mocked(getCurrentSession);
const mockedLogoutSession = vi.mocked(logoutSession);

const appSessionResult = {
  ok: true,
  data: {
    user: {
      id: 'user-1',
      name: 'Owner User',
      email: 'owner@example.com',
    },
    tenant: {
      id: 'tenant-1',
      name: 'Main Tenant',
    },
    membership: {
      role: 'owner',
    },
  },
} satisfies SessionCommandResult;

const sessionError = (errorCode: SessionErrorCode): SessionCommandResult => ({
  ok: false,
  errorCode,
});

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/session', sessionRouter);
  return app;
};

describe('session routes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('logs in and forwards session cookies from the service', async () => {
    mockedLoginSession.mockResolvedValue({
      ...appSessionResult,
      setCookieHeaders: ['better-auth.session_token=session-1; Path=/'],
    });

    const response = await request(createApp())
      .post('/api/session/login')
      .send({
        email: ' Owner@Example.COM ',
        password: 'password123',
      });

    expect(response.status).toBe(200);
    expect(response.headers['set-cookie']).toEqual([
      'better-auth.session_token=session-1; Path=/',
    ]);
    expect(response.body).toEqual(appSessionResult.data);
    expect(mockedLoginSession).toHaveBeenCalledTimes(1);
    expect(mockedLoginSession.mock.calls[0]?.[1]).toEqual({
      email: ' Owner@Example.COM ',
      password: 'password123',
    });
  });

  it.each([
    ['INVALID_LOGIN_REQUEST', 400],
    ['INVALID_CREDENTIALS', 401],
    ['TENANT_MEMBERSHIP_REQUIRED', 403],
    ['SESSION_CONTEXT_FAILED', 500],
  ] as const)('maps login error %s to HTTP %i', async (errorCode, status) => {
    mockedLoginSession.mockResolvedValue(sessionError(errorCode));

    const response = await request(createApp())
      .post('/api/session/login')
      .send({
        email: 'owner@example.com',
        password: 'password123',
      });

    expect(response.status).toBe(status);
    expect(response.body.error.code).toBe(errorCode);
  });

  it('returns the current app session', async () => {
    mockedGetCurrentSession.mockResolvedValue(appSessionResult);

    const response = await request(createApp()).get('/api/session/current');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(appSessionResult.data);
  });

  it.each([
    ['UNAUTHENTICATED', 401],
    ['TENANT_MEMBERSHIP_REQUIRED', 403],
  ] as const)(
    'maps current-session error %s to HTTP %i',
    async (errorCode, status) => {
      mockedGetCurrentSession.mockResolvedValue(sessionError(errorCode));

      const response = await request(createApp()).get('/api/session/current');

      expect(response.status).toBe(status);
      expect(response.body.error.code).toBe(errorCode);
    }
  );

  it('logs out idempotently', async () => {
    mockedLogoutSession.mockResolvedValue(undefined);

    const response = await request(createApp()).post('/api/session/logout');

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
    expect(mockedLogoutSession).toHaveBeenCalledTimes(1);
  });
});
