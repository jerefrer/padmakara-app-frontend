import { willWatermarkFile, willWatermarkTranscript } from '@/utils/watermark';

describe('willWatermarkTranscript', () => {
  it('should watermark a signed-in reader of a members-only event', () => {
    expect(willWatermarkTranscript({ isAuthenticated: true, audienceSlug: 'retreat-group-members' })).toBe(true);
  });

  it('should not watermark a transcript of a public event', () => {
    expect(willWatermarkTranscript({ isAuthenticated: true, audienceSlug: 'free-anyone' })).toBe(false);
  });

  it('should not watermark for a signed-out visitor', () => {
    expect(willWatermarkTranscript({ isAuthenticated: false, audienceSlug: 'free-subscribers' })).toBe(false);
  });

  it('should assume a watermark when the event audience is unknown, like the server does', () => {
    expect(willWatermarkTranscript({ isAuthenticated: true })).toBe(true);
    expect(willWatermarkTranscript({ isAuthenticated: true, audienceSlug: null })).toBe(true);
  });
});

describe('willWatermarkFile', () => {
  it('should watermark a sensitive PDF', () => {
    expect(willWatermarkFile({ isAuthenticated: true, sensitive: true, extension: 'pdf' })).toBe(true);
    expect(willWatermarkFile({ isAuthenticated: true, sensitive: true, extension: '.PDF' })).toBe(true);
  });

  it('should not watermark a sensitive file that is not a PDF', () => {
    expect(willWatermarkFile({ isAuthenticated: true, sensitive: true, extension: 'jpg' })).toBe(false);
  });

  it('should not watermark a PDF that is not sensitive', () => {
    expect(willWatermarkFile({ isAuthenticated: true, sensitive: false, extension: 'pdf' })).toBe(false);
    expect(willWatermarkFile({ isAuthenticated: true, extension: 'pdf' })).toBe(false);
  });

  it('should not watermark when signed out', () => {
    expect(willWatermarkFile({ isAuthenticated: false, sensitive: true, extension: 'pdf' })).toBe(false);
  });
});
