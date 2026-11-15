import { publicationUpdate } from '@/utils/publicationUpdate';

const server = { version: 'v1.0', pdfFingerprint: 'aaaa', updatedAt: '2026-11-15T22:23:52Z' };

describe('publicationUpdate', () => {
  it('should offer nothing when the cached copy is the current file and version', () => {
    const cached = { version: 'v1.0', fingerprint: 'aaaa', updatedAt: '2026-08-23T21:43:15Z' };

    expect(publicationUpdate(cached, server)).toEqual({ available: false, newVersion: null });
  });

  it('should offer the new file without a version label when the file was replaced under the same version', () => {
    const cached = { version: 'v1.0', fingerprint: 'bbbb', updatedAt: '2026-08-23T21:43:15Z' };

    expect(publicationUpdate(cached, server)).toEqual({ available: true, newVersion: null });
  });

  it('should offer the new file with its label when the version changed', () => {
    const cached = { version: 'v0.9', fingerprint: 'bbbb', updatedAt: '2026-08-23T21:43:15Z' };

    expect(publicationUpdate(cached, server)).toEqual({ available: true, newVersion: 'v1.0' });
  });

  it('should ignore an edit of the details when the file is unchanged', () => {
    const cached = { version: 'v1.0', fingerprint: 'aaaa', updatedAt: '2026-01-01T00:00:00Z' };

    expect(publicationUpdate(cached, { ...server, updatedAt: '2026-12-01T00:00:00Z' }).available).toBe(false);
  });

  it('should fall back to the update date for a copy cached before fingerprints existed', () => {
    const cached = { version: 'v1.0', fingerprint: null, updatedAt: '2026-08-23T21:43:15Z' };

    expect(publicationUpdate(cached, server)).toEqual({ available: true, newVersion: null });
    expect(publicationUpdate({ ...cached, updatedAt: server.updatedAt }, server).available).toBe(false);
  });

  it('should rely on the version alone when the server sends no fingerprint', () => {
    const cached = { version: 'v1.0', fingerprint: 'bbbb', updatedAt: '2026-08-23T21:43:15Z' };

    expect(publicationUpdate(cached, { ...server, pdfFingerprint: undefined }).available).toBe(false);
  });
});
