import { describe, expect, it } from 'vitest';

const { parseUpdateCourierProfileRequest, parseUpdateManagerProfileRequest } =
  await import('../staff-validation.js');

const expectInvalidCourierProfile = (value: unknown) => {
  expect(parseUpdateCourierProfileRequest(value).success).toBe(false);
};

const expectInvalidManagerProfile = (value: unknown) => {
  expect(parseUpdateManagerProfileRequest(value).success).toBe(false);
};

describe('parseUpdateCourierProfileRequest', () => {
  it('accepts and normalizes courier profile fields', () => {
    expect(
      parseUpdateCourierProfileRequest({
        name: ' Updated Courier ',
        phone: ' +15557654321 ',
      })
    ).toMatchObject({
      success: true,
      data: {
        name: 'Updated Courier',
        phone: '+15557654321',
      },
    });
  });

  it('rejects empty courier profile updates', () => {
    expectInvalidCourierProfile({});
  });

  it.each([
    ['null phone', { phone: null }],
    ['empty phone', { phone: '' }],
    ['whitespace-only phone', { phone: '   ' }],
    ['blank name', { name: '   ' }],
  ] as const)('rejects a courier profile update with %s', (_label, update) => {
    expectInvalidCourierProfile(update);
  });

  it.each([
    ['email', { email: 'new@example.com' }],
    ['password', { password: 'new-password' }],
    ['role', { role: 'manager' }],
    ['tenantId', { tenantId: 'tenant-2' }],
    ['userId', { userId: 'courier-2' }],
    ['courierId', { courierId: 'courier-2' }],
  ] as const)('rejects caller-supplied courier %s fields', (_label, update) => {
    expectInvalidCourierProfile({
      name: 'Updated Courier',
      ...update,
    });
  });
});

describe('parseUpdateManagerProfileRequest', () => {
  it('accepts and normalizes manager profile fields', () => {
    expect(
      parseUpdateManagerProfileRequest({
        name: ' Updated Manager ',
        phone: ' +15551234567 ',
      })
    ).toMatchObject({
      success: true,
      data: {
        name: 'Updated Manager',
        phone: '+15551234567',
      },
    });
  });

  it('normalizes cleared manager phone values to null', () => {
    expect(parseUpdateManagerProfileRequest({ phone: '' })).toMatchObject({
      success: true,
      data: {
        phone: null,
      },
    });

    expect(parseUpdateManagerProfileRequest({ phone: '   ' })).toMatchObject({
      success: true,
      data: {
        phone: null,
      },
    });
  });

  it('rejects empty manager profile updates', () => {
    expectInvalidManagerProfile({});
  });

  it('rejects blank manager names', () => {
    expectInvalidManagerProfile({ name: '   ' });
  });

  it.each([
    ['email', { email: 'new@example.com' }],
    ['password', { password: 'new-password' }],
    ['role', { role: 'courier' }],
    ['tenantId', { tenantId: 'tenant-2' }],
    ['userId', { userId: 'manager-2' }],
    ['managerId', { managerId: 'manager-2' }],
  ] as const)('rejects caller-supplied manager %s fields', (_label, update) => {
    expectInvalidManagerProfile({
      name: 'Updated Manager',
      ...update,
    });
  });
});
