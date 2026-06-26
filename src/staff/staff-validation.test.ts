import { describe, expect, it } from 'vitest';

import { parseStaffProfileUpdate } from './staff-validation.js';

describe('parseStaffProfileUpdate', () => {
  it.each([
    ['null', null],
    ['empty', ''],
    ['whitespace-only', '   '],
  ] as const)(
    'normalizes manager %s phone clearing to null',
    (_label, phone) => {
      const result = parseStaffProfileUpdate('manager', { phone });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ phone: null });
      }
    }
  );

  it.each([
    ['null', null],
    ['empty', ''],
    ['whitespace-only', '   '],
  ] as const)('rejects courier %s phone clearing', (_label, phone) => {
    const result = parseStaffProfileUpdate('courier', { phone });

    expect(result.success).toBe(false);
  });

  it.each([
    ['manager', { name: ' Updated Manager ', phone: ' +15551234567 ' }],
    ['courier', { name: ' Updated Courier ', phone: ' +15557654321 ' }],
  ] as const)('trims valid %s profile fields', (role, profile) => {
    const result = parseStaffProfileUpdate(role, profile);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({
        name: profile.name.trim(),
        phone: profile.phone.trim(),
      });
    }
  });

  it.each(['manager', 'courier'] as const)(
    'rejects empty %s profile updates',
    (role) => {
      const result = parseStaffProfileUpdate(role, {});

      expect(result.success).toBe(false);
    }
  );

  it.each([
    ['email', { email: 'new@example.com' }],
    ['password', { password: 'new-password' }],
    ['role', { role: 'manager' }],
    ['tenantId', { tenantId: 'tenant-2' }],
  ] as const)('rejects %s on staff profile updates', (_label, profile) => {
    expect(parseStaffProfileUpdate('manager', profile).success).toBe(false);
    expect(parseStaffProfileUpdate('courier', profile).success).toBe(false);
  });
});
