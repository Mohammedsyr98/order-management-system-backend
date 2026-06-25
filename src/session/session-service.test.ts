import type { Request } from 'express';
import { APIError } from 'better-auth';
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
const { getCurrentSession, loginSession, logoutSession } =
  await import('./session-service.js');

const signInEmail = vi.mocked(auth.api.signInEmail);
const signOut = vi.mocked(auth.api.signOut);
const getSession = vi.mocked(auth.api.getSession);
const select = vi.mocked(db.select);

const requestWithHeaders = (headers: Request['headers'] = {}) =>
  ({
    headers,
  }) as Request;

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

describe('session service', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('logs in with email and password and returns the app session', async () => {
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

    const result = await loginSession(requestWithHeaders(), {
      email: ' Owner@Example.COM ',
      password: 'password123',
    });

    expect(result).toEqual({
      ok: true,
      setCookieHeaders: ['better-auth.session_token=session-1; Path=/'],
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
    });
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

  it('rejects invalid login request bodies without calling Better Auth', async () => {
    const result = await loginSession(requestWithHeaders(), {
      email: '',
      password: '',
    });

    expect(result).toEqual({
      ok: false,
      errorCode: 'INVALID_LOGIN_REQUEST',
    });
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it('rejects missing login request bodies without calling Better Auth', async () => {
    const result = await loginSession(requestWithHeaders(), undefined);

    expect(result).toEqual({
      ok: false,
      errorCode: 'INVALID_LOGIN_REQUEST',
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

    const result = await loginSession(requestWithHeaders(), {
      email: 'not-an-email',
      password: 'password123',
    });

    expect(result).toEqual({
      ok: false,
      errorCode: 'INVALID_LOGIN_REQUEST',
    });
  });

  it('maps invalid credentials to a neutral login error', async () => {
    signInEmail.mockRejectedValue(
      new APIError('UNAUTHORIZED', {
        code: 'INVALID_EMAIL_OR_PASSWORD',
        message: 'Invalid email or password',
      })
    );

    const result = await loginSession(requestWithHeaders(), {
      email: 'owner@example.com',
      password: 'wrong-password',
    });

    expect(result).toEqual({
      ok: false,
      errorCode: 'INVALID_CREDENTIALS',
    });
    expect(select).not.toHaveBeenCalled();
  });

  it('cleans up login sessions when the authenticated user has no tenant membership', async () => {
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

    const result = await loginSession(requestWithHeaders(), {
      email: 'tenantless@example.com',
      password: 'password123',
    });

    expect(result).toEqual({
      ok: false,
      errorCode: 'TENANT_MEMBERSHIP_REQUIRED',
    });
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('cleans up and reports a context failure when tenant lookup fails after login', async () => {
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

    const result = await loginSession(requestWithHeaders(), {
      email: 'owner@example.com',
      password: 'password123',
    });

    expect(result).toEqual({
      ok: false,
      errorCode: 'SESSION_CONTEXT_FAILED',
    });
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('rejects current session requests without a valid session', async () => {
    getSession.mockResolvedValue(null);

    const result = await getCurrentSession(requestWithHeaders());

    expect(result).toEqual({
      ok: false,
      errorCode: 'UNAUTHENTICATED',
    });
    expect(select).not.toHaveBeenCalled();
  });

  it('returns the current app session for a valid session', async () => {
    getSession.mockResolvedValue(mockSession('user-1'));
    mockCurrentSessionRows([
      {
        tenantId: 'tenant-1',
        tenantName: 'Main Tenant',
        role: 'manager',
      },
    ]);

    const result = await getCurrentSession(requestWithHeaders());

    expect(result).toEqual({
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
          role: 'manager',
        },
      },
    });
  });

  it('rejects current session requests when the user has no tenant membership', async () => {
    getSession.mockResolvedValue(mockSession('tenantless-user'));
    mockCurrentSessionRows([]);

    const result = await getCurrentSession(requestWithHeaders());

    expect(result).toEqual({
      ok: false,
      errorCode: 'TENANT_MEMBERSHIP_REQUIRED',
    });
  });

  it('logs out idempotently', async () => {
    signOut.mockRejectedValue(new Error('missing session'));

    await expect(logoutSession(requestWithHeaders())).resolves.toBeUndefined();

    expect(signOut).toHaveBeenCalledTimes(1);
  });
});
