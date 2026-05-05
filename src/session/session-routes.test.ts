import express from 'express';
import { APIError } from 'better-auth';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../auth/auth.js', () => ({
  auth: {
    api: {
      signInEmail: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
    },
  },
}));

vi.mock('../db/index.ts', () => ({
  db: {
    select: vi.fn(),
  },
}));

const { auth } = await import('../auth/auth.js');
const { db } = await import('../db/index.js');
const { sessionRouter } = await import('./session-routes.js');

const signInEmail = vi.mocked(auth.api.signInEmail);
const signOut = vi.mocked(auth.api.signOut);
const getSession = vi.mocked(auth.api.getSession);
const select = vi.mocked(db.select);

const createApp = () => {
  const app = express();
  app.use(express.json());
  app.use('/api/session', sessionRouter);
  return app;
};

const mockCurrentSessionRows = (
  rows: Array<{
    tenantId: string;
    tenantName: string;
    role: 'owner' | 'manager' | 'courier';
  }>
) => {
  const limit = vi.fn().mockResolvedValue(rows);
  const where = vi.fn().mockReturnValue({ limit });
  const innerJoin = vi.fn().mockReturnValue({ where });
  const from = vi.fn().mockReturnValue({ innerJoin });

  select.mockReturnValue({ from } as unknown as ReturnType<typeof db.select>);
};

const mockSession = (userId: string) =>
  ({
    user: {
      id: userId,
      name: 'Owner User',
      email: 'owner@example.com',
    },
    session: { userId },
  }) as Awaited<ReturnType<typeof auth.api.getSession>>;

describe('session routes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('logs in with email and password and returns the current app session context', async () => {
    const headers = new Headers();
    headers.append('set-cookie', 'better-auth.session_token=session-1; Path=/');

    signInEmail.mockResolvedValue({
      headers,
      response: {
        redirect: false,
        token: 'session-1',
        user: {
          id: 'user-1',
          name: 'Owner User',
          email: 'owner@example.com',
          emailVerified: false,
          image: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    } as unknown as Awaited<ReturnType<typeof auth.api.signInEmail>>);
    mockCurrentSessionRows([
      {
        tenantId: 'tenant-1',
        tenantName: 'Main Tenant',
        role: 'owner',
      },
    ]);

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
    expect(response.body).toEqual({
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
    });
    expect(response.body.token).toBeUndefined();
    expect(signInEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        body: {
          email: 'owner@example.com',
          password: 'password123',
        },
        returnHeaders: true,
      })
    );
  });

  it('rejects invalid login request bodies', async () => {
    const response = await request(createApp())
      .post('/api/session/login')
      .send({
        email: '',
        password: '',
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        code: 'INVALID_LOGIN_REQUEST',
        message: 'Email and password are required.',
      },
    });
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it('maps Better Auth login validation errors to an invalid login request', async () => {
    signInEmail.mockRejectedValue(
      new APIError('BAD_REQUEST', {
        code: 'INVALID_EMAIL',
        message: 'Invalid email',
      })
    );

    const response = await request(createApp())
      .post('/api/session/login')
      .send({
        email: 'not-an-email',
        password: 'password123',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_LOGIN_REQUEST');
  });

  it('maps invalid credentials to a neutral login error', async () => {
    signInEmail.mockRejectedValue(
      new APIError('UNAUTHORIZED', {
        code: 'INVALID_EMAIL_OR_PASSWORD',
        message: 'Invalid email or password',
      })
    );

    const response = await request(createApp())
      .post('/api/session/login')
      .send({
        email: 'owner@example.com',
        password: 'wrong-password',
      });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Email or password is incorrect.',
      },
    });
    expect(select).not.toHaveBeenCalled();
  });

  it('rejects login when the authenticated user has no tenant membership', async () => {
    signInEmail.mockResolvedValue({
      headers: new Headers(),
      response: {
        redirect: false,
        token: 'session-1',
        user: {
          id: 'tenantless-user',
          name: 'Tenantless User',
          email: 'tenantless@example.com',
          emailVerified: false,
          image: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    } as unknown as Awaited<ReturnType<typeof auth.api.signInEmail>>);
    signOut.mockResolvedValue({ success: true });
    mockCurrentSessionRows([]);

    const response = await request(createApp())
      .post('/api/session/login')
      .send({
        email: 'tenantless@example.com',
        password: 'password123',
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: {
        code: 'TENANT_MEMBERSHIP_REQUIRED',
        message:
          'Your account is not linked to a tenant. Contact support for help.',
      },
    });
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('cleans up and reports a session context failure when tenant lookup fails after login', async () => {
    signInEmail.mockResolvedValue({
      headers: new Headers(),
      response: {
        redirect: false,
        token: 'session-1',
        user: {
          id: 'user-1',
          name: 'Owner User',
          email: 'owner@example.com',
          emailVerified: false,
          image: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
    } as unknown as Awaited<ReturnType<typeof auth.api.signInEmail>>);
    signOut.mockResolvedValue({ success: true });
    const limit = vi.fn().mockRejectedValue(new Error('database unavailable'));
    const where = vi.fn().mockReturnValue({ limit });
    const innerJoin = vi.fn().mockReturnValue({ where });
    const from = vi.fn().mockReturnValue({ innerJoin });
    select.mockReturnValue({ from } as unknown as ReturnType<typeof db.select>);

    const response = await request(createApp())
      .post('/api/session/login')
      .send({
        email: 'owner@example.com',
        password: 'password123',
      });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      error: {
        code: 'SESSION_CONTEXT_FAILED',
        message: 'Session context could not be resolved.',
      },
    });
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('rejects current session requests without a valid session', async () => {
    getSession.mockResolvedValue(null);

    const response = await request(createApp()).get('/api/session/current');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        code: 'UNAUTHENTICATED',
        message: 'You must sign in to perform this action.',
      },
    });
    expect(select).not.toHaveBeenCalled();
  });

  it('returns the current app session context for a valid session', async () => {
    getSession.mockResolvedValue(mockSession('user-1'));
    mockCurrentSessionRows([
      {
        tenantId: 'tenant-1',
        tenantName: 'Main Tenant',
        role: 'manager',
      },
    ]);

    const response = await request(createApp()).get('/api/session/current');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
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
        role: 'manager',
      },
    });
  });

  it('rejects current session requests when the user has no tenant membership', async () => {
    getSession.mockResolvedValue(mockSession('tenantless-user'));
    mockCurrentSessionRows([]);

    const response = await request(createApp()).get('/api/session/current');

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('TENANT_MEMBERSHIP_REQUIRED');
  });

  it('logs out idempotently', async () => {
    signOut.mockRejectedValue(new Error('missing session'));

    const response = await request(createApp()).post('/api/session/logout');

    expect(response.status).toBe(204);
    expect(response.body).toEqual({});
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
