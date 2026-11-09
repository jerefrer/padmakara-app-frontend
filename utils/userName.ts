import type { User } from '@/types';

/**
 * The API sends one `name` only, and falls back to the email address for an account
 * that has no first or last name yet. So "no name" means empty or equal to the email.
 */
export function hasUserName(user: Pick<User, 'name' | 'email'>): boolean {
  const name = (user.name ?? '').trim();
  if (!name) return false;
  return name.toLowerCase() !== (user.email ?? '').trim().toLowerCase();
}

/** Splits the displayed name for the edit fields: the first word is the first name, the rest the last. */
export function splitUserName(user: Pick<User, 'name' | 'email'>): { firstName: string; lastName: string } {
  if (!hasUserName(user)) return { firstName: '', lastName: '' };
  const [first, ...rest] = user.name.trim().split(/\s+/);
  return { firstName: first, lastName: rest.join(' ') };
}
