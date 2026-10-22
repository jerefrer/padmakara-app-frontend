import { resolveContentTab, shouldShowInlinePlayer } from './eventContentTab';

const all = { hasVideo: true, hasAudio: true, hasDocuments: true };

describe('resolveContentTab', () => {
  it('should return the requested tab when the event has that content', () => {
    expect(resolveContentTab('tracks', all)).toBe('tracks');
  });

  it('should fall back to video when the requested tab has no content', () => {
    expect(resolveContentTab('documents', { ...all, hasDocuments: false })).toBe('video');
  });

  it('should fall back to audio when the event has no video', () => {
    expect(resolveContentTab('video', { hasVideo: false, hasAudio: true, hasDocuments: true })).toBe('tracks');
  });

  it('should fall back to documents when it is the only content', () => {
    expect(resolveContentTab('video', { hasVideo: false, hasAudio: false, hasDocuments: true })).toBe('documents');
  });
});

describe('shouldShowInlinePlayer', () => {
  it('should show the player on the audio tab when this event owns the loaded track', () => {
    expect(shouldShowInlinePlayer({ ownsCurrentTrack: true, activeTab: 'tracks' })).toBe(true);
  });

  it('should hide the player on the video tab even when this event owns the loaded track', () => {
    expect(shouldShowInlinePlayer({ ownsCurrentTrack: true, activeTab: 'video' })).toBe(false);
  });

  it('should hide the player on the documents tab', () => {
    expect(shouldShowInlinePlayer({ ownsCurrentTrack: true, activeTab: 'documents' })).toBe(false);
  });

  it('should hide the player on the audio tab when the loaded track belongs to another event', () => {
    expect(shouldShowInlinePlayer({ ownsCurrentTrack: false, activeTab: 'tracks' })).toBe(false);
  });
});
