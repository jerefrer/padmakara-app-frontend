import type { Breadcrumb } from '@sentry/react-native';

/**
 * What Sentry may know about a person, per the privacy policy: the account
 * number, so reports can be traced to one account, and never the email.
 */
export function sentryUser(user: { id: string } | null): { id: string } | null {
  return user ? { id: String(user.id) } : null;
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export function redactEmails(text: string): string {
  return text.replace(EMAIL, '[email]');
}

function scrubValue(value: unknown): unknown {
  if (typeof value === 'string') return redactEmails(value);
  if (Array.isArray(value)) return value.map(scrubValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, v]) => [key, scrubValue(v)]),
    );
  }
  return value;
}

/**
 * Breadcrumbs carry console logs and request URLs, some of which print the
 * signed-in email; they are scrubbed before they leave the device.
 */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  return {
    ...breadcrumb,
    ...(breadcrumb.message !== undefined && { message: redactEmails(breadcrumb.message) }),
    ...(breadcrumb.data !== undefined && {
      data: scrubValue(breadcrumb.data) as Breadcrumb['data'],
    }),
  };
}
