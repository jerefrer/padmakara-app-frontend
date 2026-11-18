import retreatService, { normalizeSessionType } from './retreatService';
import apiService from './apiService';

jest.mock('./apiService', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

const apiGet = apiService.get as jest.Mock;

describe('normalizeSessionType()', () => {
  it('passes through the periods the UI has labels for', () => {
    expect(normalizeSessionType('morning')).toBe('morning');
    expect(normalizeSessionType('afternoon')).toBe('afternoon');
    expect(normalizeSessionType('evening')).toBe('evening');
    expect(normalizeSessionType('full_day')).toBe('full_day');
  });

  it('normalizes case and surrounding whitespace', () => {
    expect(normalizeSessionType('  MORNING ')).toBe('morning');
    expect(normalizeSessionType('Afternoon')).toBe('afternoon');
  });

  // time_period is untyped text with no DB constraint, and around a quarter of
  // production sessions leave it null. Anything unrecognized has to land on
  // 'other' — the session header looks the label up by key, and an unknown
  // value would have no translation to find.
  it("maps anything unrecognized to 'other'", () => {
    expect(normalizeSessionType(null)).toBe('other');
    expect(normalizeSessionType(undefined)).toBe('other');
    expect(normalizeSessionType('')).toBe('other');
    expect(normalizeSessionType('   ')).toBe('other');
    expect(normalizeSessionType('night')).toBe('other');
    expect(normalizeSessionType(42)).toBe('other');
    expect(normalizeSessionType({})).toBe('other');
  });
});

describe('isTrackAudioDenied()', () => {
  it('should report a refusal when the track is gone or hidden', async () => {
    apiGet.mockResolvedValueOnce({ success: false, status: 404, error: 'Track not found' });
    expect(await retreatService.isTrackAudioDenied('7')).toBe(true);
  });

  it('should report a refusal when access to the event was lost', async () => {
    apiGet.mockResolvedValueOnce({ success: false, status: 403, error: 'Group membership required' });
    expect(await retreatService.isTrackAudioDenied('7')).toBe(true);
  });

  it('should report a refusal when the audio needs a sign-in the caller lacks', async () => {
    apiGet.mockResolvedValueOnce({ success: false, error: 'Authentication required.', authRequired: true });
    expect(await retreatService.isTrackAudioDenied('7')).toBe(true);
  });

  it('should not report a refusal when the network is down', async () => {
    apiGet.mockResolvedValueOnce({ success: false, error: 'Network error. Please check your internet connection.' });
    expect(await retreatService.isTrackAudioDenied('7')).toBe(false);
  });

  it('should not report a refusal when the server is failing', async () => {
    apiGet.mockResolvedValueOnce({ success: false, status: 500, error: 'HTTP 500' });
    expect(await retreatService.isTrackAudioDenied('7')).toBe(false);
  });

  it('should not report a refusal when the audio is available', async () => {
    apiGet.mockResolvedValueOnce({ success: true, data: { url: 'https://cdn/x.mp3' } });
    expect(await retreatService.isTrackAudioDenied('7')).toBe(false);
  });
});
