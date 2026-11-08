import type { createFakeFileSystem } from '../../__mocks__/fakeFileSystem';

jest.mock('expo-file-system/legacy', () => {
  const fake = require('../../__mocks__/fakeFileSystem').createFakeFileSystem();
  return {
    ...fake,
    createDownloadResumable: jest.fn((_url: string, path: string) => ({
      downloadAsync: async () => {
        fake.addFile(path, 5_000, Date.now() / 1000);
        return { uri: path };
      },
    })),
  };
});

type Fs = ReturnType<typeof createFakeFileSystem> & { createDownloadResumable: jest.Mock };

const MB = 1024 * 1024;
const OLD = 1_000; // seconds since epoch: long past the in-flight window
const AUDIO = 'file:///cache/audio/';
const METADATA_KEY = '@audio_cache:metadata';
const SETTINGS_KEY = '@audio_cache:settings';

interface SeedEntry {
  trackId: string;
  retreatId?: string;
  fileSize: number;
  filePath?: string;
  lastAccessedAt?: string;
}

/** Fresh service instance (it is a singleton) on a fresh fake file system. */
async function setup(opts: { limit?: number; entries?: SeedEntry[] } = {}) {
  jest.resetModules();
  const asyncStorageModule = require('@react-native-async-storage/async-storage');
  const AsyncStorage = asyncStorageModule.default ?? asyncStorageModule;
  const fs = jest.requireMock('expo-file-system/legacy') as Fs;
  if (opts.limit !== undefined) {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ maxSizeBytes: opts.limit }));
  }
  if (opts.entries) {
    const meta = opts.entries.map(e => ({
      trackId: e.trackId,
      retreatId: e.retreatId ?? 'r1',
      filePath: e.filePath ?? `${AUDIO}${e.trackId}.mp3`,
      fileSize: e.fileSize,
      cachedAt: '2026-01-01T00:00:00.000Z',
      lastAccessedAt: e.lastAccessedAt ?? '2026-01-01T00:00:00.000Z',
    }));
    await AsyncStorage.setItem(METADATA_KEY, JSON.stringify(meta));
  }
  const service = require('../../services/cacheService').default;
  return { service, fs, AsyncStorage };
}

describe('cacheService container path changes', () => {
  it('should find a cached track when the app container path changed since it was cached', async () => {
    const { service, fs } = await setup({
      entries: [{ trackId: '123', fileSize: 100, filePath: 'file:///old-container/cache/audio/123.mp3' }],
    });
    fs.addFile(`${AUDIO}123.mp3`, 100, OLD);

    expect(await service.getCachedTrackPath('123')).toBe(`${AUDIO}123.mp3`);
    expect(await service.isTrackCached('123')).toBe(true);
  });
});

describe('cacheService orphan adoption', () => {
  it('should adopt an untracked mp3 in the audio cache folder at startup and count it toward the limit', async () => {
    const { service, fs } = await setup();
    fs.addFile(`${AUDIO}77.mp3`, 3 * MB, OLD);

    const stats = await service.getCacheStats();

    expect(stats.trackCount).toBe(1);
    expect(stats.totalSize).toBe(3 * MB);
    expect(await service.isTrackCached('77')).toBe(true);
    expect(await service.getCachedTrackIdsForRetreat('unknown')).toEqual(['77']);
  });

  it('should persist adopted files so the next launch still tracks them', async () => {
    const { service, fs, AsyncStorage } = await setup();
    fs.addFile(`${AUDIO}77.mp3`, 3 * MB, OLD);

    await service.initialize();

    const saved = JSON.parse(await AsyncStorage.getItem(METADATA_KEY));
    expect(saved.map((m: { trackId: string }) => m.trackId)).toEqual(['77']);
  });

  it('should evict down to the limit at startup when adopted files exceed it', async () => {
    const { service, fs } = await setup({ limit: 5 * MB });
    fs.addFile(`${AUDIO}1.mp3`, 3 * MB, OLD); // oldest
    fs.addFile(`${AUDIO}2.mp3`, 3 * MB, OLD + 10);
    fs.addFile(`${AUDIO}3.mp3`, 3 * MB, OLD + 20);

    const stats = await service.getCacheStats();

    expect(stats.totalSize).toBeLessThanOrEqual(5 * MB);
    expect(fs.has(`${AUDIO}1.mp3`)).toBe(false);
    expect(fs.has(`${AUDIO}3.mp3`)).toBe(true);
  });

  it('should leave a recently modified untracked file alone when it may be an in-flight download', async () => {
    const { service, fs } = await setup();
    fs.addFile(`${AUDIO}9.mp3`, 1 * MB, Date.now() / 1000 - 30);
    fs.addFile(`${AUDIO}9.mp3.tmp`, 1 * MB, Date.now() / 1000 - 30);

    const stats = await service.getCacheStats();

    expect(stats.trackCount).toBe(0);
    expect(fs.has(`${AUDIO}9.mp3`)).toBe(true);
    expect(fs.has(`${AUDIO}9.mp3.tmp`)).toBe(true);
  });

  it('should delete an old non-mp3 file in the audio cache folder at startup', async () => {
    const { service, fs } = await setup();
    fs.addFile(`${AUDIO}junk.tmp`, 1 * MB, OLD);

    await service.initialize();

    expect(fs.has(`${AUDIO}junk.tmp`)).toBe(false);
  });
});

describe('cacheService eviction', () => {
  it('should evict the protected retreat\'s oldest tracks when other retreats alone cannot free enough space', async () => {
    const { service, fs } = await setup({
      limit: 10 * MB,
      entries: [
        { trackId: 'a', retreatId: 'r1', fileSize: 4 * MB, lastAccessedAt: '2026-01-01T00:00:00.000Z' },
        { trackId: 'b', retreatId: 'r1', fileSize: 4 * MB, lastAccessedAt: '2026-01-02T00:00:00.000Z' },
        { trackId: 'c', retreatId: 'r2', fileSize: 1 * MB, lastAccessedAt: '2026-01-03T00:00:00.000Z' },
      ],
    });
    fs.addFile(`${AUDIO}a.mp3`, 4 * MB, OLD);
    fs.addFile(`${AUDIO}b.mp3`, 4 * MB, OLD);
    fs.addFile(`${AUDIO}c.mp3`, 1 * MB, OLD);
    fs.createDownloadResumable.mockImplementationOnce((_url: string, path: string) => ({
      downloadAsync: async () => {
        fs.addFile(path, 3 * MB, Date.now() / 1000);
        return { uri: path };
      },
    }));
    await service.cacheTrack('d', 'r1', 'https://x/d.mp3');

    // Other retreat is evicted first, then the protected retreat's oldest track.
    expect(fs.has(`${AUDIO}c.mp3`)).toBe(false);
    expect(fs.has(`${AUDIO}a.mp3`)).toBe(false);
    expect(fs.has(`${AUDIO}b.mp3`)).toBe(true);
    expect(fs.has(`${AUDIO}d.mp3`)).toBe(true);
  });

  it('should evict other retreats before the protected retreat when both are over the limit', async () => {
    const { service, fs } = await setup({
      limit: 10 * MB,
      entries: [
        { trackId: 'a', retreatId: 'r1', fileSize: 4 * MB, lastAccessedAt: '2026-01-01T00:00:00.000Z' },
        { trackId: 'c', retreatId: 'r2', fileSize: 5 * MB, lastAccessedAt: '2026-01-03T00:00:00.000Z' },
      ],
    });
    fs.addFile(`${AUDIO}a.mp3`, 4 * MB, OLD);
    fs.addFile(`${AUDIO}c.mp3`, 5 * MB, OLD);

    fs.createDownloadResumable.mockImplementationOnce((_url: string, path: string) => ({
      downloadAsync: async () => {
        fs.addFile(path, 3 * MB, Date.now() / 1000);
        return { uri: path };
      },
    }));
    await service.cacheTrack('d', 'r1', 'https://x/d.mp3');

    expect(fs.has(`${AUDIO}c.mp3`)).toBe(false);
    expect(fs.has(`${AUDIO}a.mp3`)).toBe(true);
  });
});
