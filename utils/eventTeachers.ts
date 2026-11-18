/**
 * Main teachers vs guests / other speakers of an event (André, product owner):
 * the main teachers are shown as before, the guests only where there is room
 * for a second line ("with the presence of Shechen Rabjam Rinpoche"), never in
 * compact places (cards, lists, the mini player), so a visiting teacher's few
 * sessions are not given the weight of the main teachings.
 *
 * Search and the teacher filters keep using every teacher of the event, so an
 * event is still found under its guests.
 */
import type { GuestIntroKey } from '@/types';

type Translate = (key: string) => string | undefined;

interface WithRole {
  role?: string | null;
  name?: string | null;
}

const isGuest = (t: WithRole) => t.role === 'guest';

/**
 * The teachers to show as the event's teachers. When an event has only guests
 * (not expected, but nothing prevents it) they stand in, so no header goes blank.
 */
export function mainTeachers<T extends WithRole>(teachers: readonly T[] | null | undefined): T[] {
  const all = teachers ?? [];
  const main = all.filter((t) => !isGuest(t));
  return main.length > 0 ? main : [...all];
}

/** The guests / other speakers, in order; empty when they already stand in as main teachers. */
export function guestTeachers<T extends WithRole>(teachers: readonly T[] | null | undefined): T[] {
  const all = teachers ?? [];
  return all.some((t) => !isGuest(t)) ? all.filter(isGuest) : [];
}

/** The main teachers' names, the way the app has always joined them. */
export function mainTeacherNames(teachers: readonly WithRole[] | null | undefined): string {
  return mainTeachers(teachers)
    .map((t) => t.name ?? '')
    .filter(Boolean)
    .join(', ');
}

/** The localized phrase for a guest intro key; an unknown or missing key reads as the default. */
export function guestIntroLabel(key: GuestIntroKey | string | null | undefined, t: Translate): string {
  switch (key) {
    case 'and':
      return t('events.guestIntro.and') || '&';
    case 'practice_sessions_by':
      return t('events.guestIntro.practice_sessions_by') || 'practice sessions by';
    case 'with_visit_of':
      return t('events.guestIntro.with_visit_of') || 'with the visit of';
    case 'with_guest':
      return t('events.guestIntro.with_guest') || 'with';
    default:
      return t('events.guestIntro.with_presence_of') || 'with the presence of';
  }
}

/** "with the presence of Shechen Rabjam Rinpoche", or null when the event has no guests. */
export function guestLine(
  event: { teachers?: readonly WithRole[] | null; guestIntro?: string | null } | null | undefined,
  t: Translate,
): string | null {
  const names = guestTeachers(event?.teachers)
    .map((g) => g.name ?? '')
    .filter(Boolean);
  if (names.length === 0) return null;
  return `${guestIntroLabel(event?.guestIntro, t)} ${names.join(', ')}`;
}
