export type UpdateTenantProfileRequest = {
  name?: unknown;
  phone?: unknown;
  timezone?: unknown;
  operatingHours?: unknown;
};

export const weekDays = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type WeekDay = (typeof weekDays)[number];

export type ClosedOperatingDay = {
  status: 'closed';
};

export type OpenOperatingDay = {
  status: 'open';
  open: string;
  close: string;
};

export type OperatingDay = ClosedOperatingDay | OpenOperatingDay;

export type OperatingHours = Record<WeekDay, OperatingDay>;

export const defaultOperatingHours = {
  monday: { status: 'open', open: '09:00', close: '17:00' },
  tuesday: { status: 'open', open: '09:00', close: '17:00' },
  wednesday: { status: 'open', open: '09:00', close: '17:00' },
  thursday: { status: 'open', open: '09:00', close: '17:00' },
  friday: { status: 'open', open: '09:00', close: '17:00' },
  saturday: { status: 'open', open: '09:00', close: '17:00' },
  sunday: { status: 'closed' },
} satisfies OperatingHours;

export const defaultTenantTimezone = 'Europe/Istanbul';

export type TenantProfileResponse = {
  tenant: {
    id: string;
    name: string;
    phone: string;
    timezone: string;
    operatingHours: OperatingHours;
  };
};
