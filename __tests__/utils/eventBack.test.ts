import { eventBackTarget } from '../../utils/eventBack';

describe('eventBackTarget', () => {
  it('should step back through the stack when there is a screen to return to, even when opened from the events list', () => {
    // Home → Teachings & talks → Teacher → Event: back must land on the
    // teacher, not push a fresh events list on top of it (André, 22/08).
    expect(eventBackTarget({ canGoBack: true, from: 'events' })).toEqual({ kind: 'back' });
  });

  it('should step back through the stack for an event opened from anywhere else', () => {
    expect(eventBackTarget({ canGoBack: true, from: undefined })).toEqual({ kind: 'back' });
  });

  it('should open the events list when an event opened from it has nothing behind it', () => {
    expect(eventBackTarget({ canGoBack: false, from: 'events' })).toEqual({
      kind: 'replace',
      href: '/(tabs)/(groups)/events',
    });
  });

  it('should open home when an event reached by a deep link has nothing behind it', () => {
    expect(eventBackTarget({ canGoBack: false, from: undefined })).toEqual({
      kind: 'replace',
      href: '/(tabs)/(groups)',
    });
  });
});
