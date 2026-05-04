import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';

describe('auth routes', () => {
  let app: Express;

  beforeAll(async () => {
    process.env.BETTER_AUTH_SECRET = 'test-secret-at-least-32-characters';
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.DATABASE_URL =
      'postgresql://user:password@localhost:5432/order_management_test';

    ({ app } = await import('./app.js'));
  });

  it('mounts the Better Auth health route', async () => {
    const response = await request(app).get('/api/auth/ok');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ ok: true });
  });

  it('returns null when no session cookie is present', async () => {
    const response = await request(app).get('/api/auth/get-session');

    expect(response.status).toBe(200);
    expect(response.body).toBeNull();
  });

  it('enables email/password auth on the mounted route', async () => {
    const response = await request(app)
      .post('/api/auth/sign-in/email')
      .set('origin', 'http://localhost:3000')
      .send({
        email: 'not-an-email',
        password: 'password123',
      });

    expect(response.status).toBe(400);
    expect(response.body.code).not.toBe('EMAIL_PASSWORD_DISABLED');
  });
});
