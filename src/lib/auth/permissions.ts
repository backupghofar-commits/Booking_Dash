export const ROLES = ['ADMIN', 'MANAGER', 'STAFF', 'FINANCE', 'VIEWER'] as const;
export type Role = (typeof ROLES)[number];

export type Permission =
  | 'bookings.read'
  | 'bookings.create'
  | 'bookings.update'
  | 'bookings.delete'
  | 'bookings.pay'
  | 'bookings.status'
  | 'settings.read'
  | 'settings.update'
  | 'users.read'
  | 'users.manage'
  | 'audit.read'
  | 'export'
  | 'masters.manage'
  | 'data.reset';

const ALL: Permission[] = [
  'bookings.read',
  'bookings.create',
  'bookings.update',
  'bookings.delete',
  'bookings.pay',
  'bookings.status',
  'settings.read',
  'settings.update',
  'users.read',
  'users.manage',
  'audit.read',
  'export',
  'masters.manage',
  'data.reset',
];

const MATRIX: Record<Role, Permission[]> = {
  ADMIN: ALL,
  MANAGER: ALL.filter((p) => p !== 'users.manage' && p !== 'data.reset'),
  STAFF: [
    'bookings.read',
    'bookings.create',
    'bookings.update',
    'bookings.pay',
    'bookings.status',
    'settings.read',
    'export',
    'masters.manage',
  ],
  FINANCE: [
    'bookings.read',
    'bookings.pay',
    'bookings.status',
    'settings.read',
    'audit.read',
    'export',
  ],
  VIEWER: ['bookings.read', 'settings.read'],
};

export function hasPermission(role: string, permission: Permission): boolean {
  const r = (ROLES as readonly string[]).includes(role) ? (role as Role) : 'VIEWER';
  return MATRIX[r].includes(permission);
}

export function assertPermission(role: string, permission: Permission) {
  if (!hasPermission(role, permission)) {
    const err = new Error('Forbidden');
    (err as Error & { status: number }).status = 403;
    throw err;
  }
}
