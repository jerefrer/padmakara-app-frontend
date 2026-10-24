import AsyncStorage from '@react-native-async-storage/async-storage';
import type { createFakeFileSystem } from '../../__mocks__/fakeFileSystem';

jest.mock('expo-file-system/legacy', () =>
  require('../../__mocks__/fakeFileSystem').createFakeFileSystem(),
);

import {
  clearCacheOnlyFiles,
  getStorageUsage,
  removeOrphanedDocuments,
} from '@/services/storageUsageService';

const fs = jest.requireMock('expo-file-system/legacy') as ReturnType<typeof createFakeFileSystem>;

const OLD = 1_000; // seconds since epoch: long enough ago to be safe to delete
const NOW_SECONDS = () => Date.now() / 1000;

beforeEach(async () => {
  for (const dir of ['doc/downloads', 'doc/tracks', 'doc/videos', 'doc/publications', 'cache/audio', 'cache/event-files', 'cache/transcripts']) {
    await fs.deleteAsync(`file:///${dir}`);
  }
});

describe('getStorageUsage', () => {
  it('should count videos, tracks, event files and transcripts that the old screen ignored', async () => {
    fs.addFile('file:///doc/videos/video-1.mp4', 3_000, OLD);
    fs.addFile('file:///doc/tracks/t1.mp3', 500, OLD);
    fs.addFile('file:///cache/event-files/a.pdf', 40, OLD);
    fs.addFile('file:///cache/transcripts/b.pdf', 60, OLD);

    const usage = await getStorageUsage([]);

    expect(usage.videos).toBe(3_000);
    expect(usage.other).toBe(600);
    expect(usage.total).toBe(3_600);
  });

  it('should count audio cache files that have no metadata', async () => {
    fs.addFile('file:///cache/audio/orphan.mp3', 700, OLD);
    expect((await getStorageUsage([])).cache).toBe(700);
  });

  it('should split downloads into known retreats and orphaned folders', async () => {
    fs.addFile('file:///doc/downloads/r1/1.mp3', 100, OLD);
    fs.addFile('file:///doc/downloads/lost/1.mp3', 80, OLD);

    const usage = await getStorageUsage(['r1']);

    expect(usage.downloads).toBe(100);
    expect(usage.other).toBe(80);
    expect(usage.orphanBytes).toBe(80);
  });

  it('should not report a download folder written minutes ago as orphaned', async () => {
    fs.addFile('file:///doc/downloads/active/1.mp3', 80, NOW_SECONDS());
    expect((await getStorageUsage([])).orphanBytes).toBe(0);
  });

  it('should treat track files with metadata as known', async () => {
    fs.addFile('file:///doc/tracks/t1.mp3', 500, OLD);
    fs.addFile('file:///doc/tracks/t2.mp3', 300, OLD);
    await AsyncStorage.setItem('@download:t1', JSON.stringify({ localPath: 'file:///doc/tracks/t1.mp3' }));

    expect((await getStorageUsage([])).orphanBytes).toBe(300);
  });
});

describe('clearCacheOnlyFiles', () => {
  it('should remove orphan audio, event files and transcripts', async () => {
    fs.addFile('file:///cache/audio/orphan.mp3', 700, OLD);
    fs.addFile('file:///cache/event-files/a.pdf', 40, OLD);
    fs.addFile('file:///cache/transcripts/b.pdf', 60, OLD);

    expect(await clearCacheOnlyFiles()).toBe(800);
    expect(fs.has('file:///cache/audio/orphan.mp3')).toBe(false);
  });

  it('should keep audio files written minutes ago because they may still be downloading', async () => {
    fs.addFile('file:///cache/audio/partial.mp3', 100, NOW_SECONDS());
    await clearCacheOnlyFiles();
    expect(fs.has('file:///cache/audio/partial.mp3')).toBe(true);
  });

  it('should never touch videos, downloads or publications', async () => {
    fs.addFile('file:///doc/videos/video-1.mp4', 3_000, OLD);
    fs.addFile('file:///doc/downloads/r1/1.mp3', 100, OLD);
    fs.addFile('file:///doc/publications/p.pdf', 20, OLD);
    await clearCacheOnlyFiles();
    expect(fs.has('file:///doc/videos/video-1.mp4')).toBe(true);
    expect(fs.has('file:///doc/downloads/r1/1.mp3')).toBe(true);
    expect(fs.has('file:///doc/publications/p.pdf')).toBe(true);
  });
});

describe('removeOrphanedDocuments', () => {
  it('should remove folders no known retreat owns and keep known ones', async () => {
    fs.addFile('file:///doc/downloads/r1/1.mp3', 100, OLD);
    fs.addFile('file:///doc/downloads/lost/1.mp3', 80, OLD);

    expect(await removeOrphanedDocuments(['r1'])).toBe(80);
    expect(fs.has('file:///doc/downloads/lost')).toBe(false);
    expect(fs.has('file:///doc/downloads/r1/1.mp3')).toBe(true);
  });

  it('should leave videos alone even though they have no download record', async () => {
    fs.addFile('file:///doc/videos/video-9.mp4', 3_000, OLD);
    await removeOrphanedDocuments([]);
    expect(fs.has('file:///doc/videos/video-9.mp4')).toBe(true);
  });
});
