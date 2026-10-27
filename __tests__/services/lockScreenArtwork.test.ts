const mockAsset = { localUri: null as string | null, uri: 'http://metro/icon.png', downloadAsync: jest.fn() };
jest.mock('expo-asset', () => ({ Asset: { fromModule: jest.fn(() => mockAsset) } }));

import { getLockScreenArtworkUri, __resetLockScreenArtwork } from '@/services/lockScreenArtwork';

describe('getLockScreenArtworkUri', () => {
  beforeEach(() => {
    __resetLockScreenArtwork();
    mockAsset.localUri = null;
    mockAsset.downloadAsync.mockReset();
  });

  it('should return the local file after downloading the asset', async () => {
    mockAsset.downloadAsync.mockImplementation(async () => { mockAsset.localUri = 'file:///cache/icon.png'; });
    expect(await getLockScreenArtworkUri()).toBe('file:///cache/icon.png');
  });

  it('should fall back to the asset uri when no local copy is produced', async () => {
    mockAsset.downloadAsync.mockResolvedValue(undefined);
    expect(await getLockScreenArtworkUri()).toBe('http://metro/icon.png');
  });

  it('should return null when the asset cannot be loaded', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockAsset.downloadAsync.mockRejectedValue(new Error('boom'));
    expect(await getLockScreenArtworkUri()).toBeNull();
  });
});
