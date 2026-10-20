export type EventBackTarget =
  | { kind: 'back' }
  | { kind: 'replace'; href: '/(tabs)/(groups)/events' | '/(tabs)/(groups)' };

/**
 * Where the event screen's back arrow goes.
 *
 * Back always climbs the stack when there is something to climb to. It used
 * to replace the screen with the events list whenever the event was opened
 * from it — a leftover from when that list lived in its own tab. Inside one
 * stack, the replace pushed a fresh list on top of whatever came before
 * (Home → Teachings → Teacher → Event → back = a second Teachings list above
 * the teacher), so the arrow seemed to go forward again.
 *
 * Only an event with nothing behind it (a deep link, a cold start) needs a
 * destination chosen for it.
 */
export function eventBackTarget({
  canGoBack,
  from,
}: {
  canGoBack: boolean;
  from: string | undefined;
}): EventBackTarget {
  if (canGoBack) return { kind: 'back' };
  return { kind: 'replace', href: from === 'events' ? '/(tabs)/(groups)/events' : '/(tabs)/(groups)' };
}
