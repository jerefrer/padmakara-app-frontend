import type { User } from '@/types';

type NamedUser = Pick<User, 'name' | 'email' | 'first_name' | 'last_name'>;

/**
 * The API sends `first_name` / `last_name`, plus a display `name` that falls back to the
 * email address for an account with no name yet. Older API responses carry `name` only:
 * then "no name" means empty or equal to the email.
 */
export function hasUserName(user: NamedUser): boolean {
  if (user.first_name !== undefined || user.last_name !== undefined) {
    return Boolean((user.first_name ?? '').trim() || (user.last_name ?? '').trim());
  }
  const name = (user.name ?? '').trim();
  if (!name) return false;
  return name.toLowerCase() !== (user.email ?? '').trim().toLowerCase();
}

/**
 * The edit fields: the parts the API sends, or else the display name split after its
 * first word.
 */
export function splitUserName(user: NamedUser): { firstName: string; lastName: string } {
  if (!hasUserName(user)) return { firstName: '', lastName: '' };
  if (user.first_name !== undefined || user.last_name !== undefined) {
    return { firstName: user.first_name ?? '', lastName: user.last_name ?? '' };
  }
  const [first, ...rest] = user.name.trim().split(/\s+/);
  return { firstName: first, lastName: rest.join(' ') };
}
