import bcrypt from 'bcryptjs';

const ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function validatePasswordStrength(plain: string): string | null {
  if (plain.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Za-z]/.test(plain) || !/[0-9]/.test(plain)) {
    return 'Password must contain letters and numbers';
  }
  return null;
}
