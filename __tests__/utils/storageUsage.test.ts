import type { createFakeFileSystem } from '../../__mocks__/fakeFileSystem';

jest.mock('expo-file-system/legacy', () =>
  require('../../__mocks__/fakeFileSystem').createFakeFileSystem(),
);

import {
  buildStorageBreakdown,
  emptyDirectory,
  getBarSegments,
  getPathSize,
  listDirectory,
} from '@/utils/storageUsage';

const mockFs = jest.requireMock('expo-file-system/legacy') as ReturnType<typeof createFakeFileSystem>;

beforeEach(() => {
  // Fresh tree for every test.
  for (const p of ['file:///doc/videos', 'file:///doc/downloads', 'file:///cache/audio']) {
    mockFs.deleteAsync(p);
  }
});

describe('getPathSize', () => {
  it('should sum nested files when the path is a directory', async () => {
    mockFs.addFile('file:///doc/downloads/a/1.mp3', 100);
    mockFs.addFile('file:///doc/downloads/a/2.mp3', 50);
    mockFs.addFile('file:///doc/downloads/b/3.mp3', 25);
    expect(await getPathSize('file:///doc/downloads/')).toBe(175);
  });

  it('should return the file size when the path is a file', async () => {
    mockFs.addFile('file:///doc/videos/video-1.mp4', 2_000);
    expect(await getPathSize('file:///doc/videos/video-1.mp4')).toBe(2_000);
  });

  it('should return 0 when the path does not exist', async () => {
    expect(await getPathSize('file:///doc/nope/')).toBe(0);
  });

  it('should return 0 when the file system throws', async () => {
    mockFs.getInfoAsync.mockRejectedValueOnce(new Error('boom'));
    expect(await getPathSize('file:///doc/downloads/')).toBe(0);
  });
});

describe('listDirectory', () => {
  it('should list children with recursive sizes and kinds', async () => {
    mockFs.addFile('file:///cache/audio/x.mp3', 10, 5);
    mockFs.addFile('file:///cache/audio/sub/y.mp3', 20);
    const entries = (await listDirectory('file:///cache/audio/')).sort((a, b) => a.name.localeCompare(b.name));
    expect(entries.map((e) => [e.name, e.size, e.isDirectory])).toEqual([
      ['sub', 20, true],
      ['x.mp3', 10, false],
    ]);
    expect(entries[1].modifiedAt).toBe(5);
  });

  it('should return an empty list when the directory is missing', async () => {
    expect(await listDirectory('file:///cache/audio/')).toEqual([]);
  });
});

describe('emptyDirectory', () => {
  it('should delete children and report the freed bytes', async () => {
    mockFs.addFile('file:///cache/audio/x.mp3', 10);
    mockFs.addFile('file:///cache/audio/y.mp3', 20);
    expect(await emptyDirectory('file:///cache/audio/')).toBe(30);
    expect(mockFs.has('file:///cache/audio/x.mp3')).toBe(false);
  });

  it('should keep entries the predicate protects', async () => {
    mockFs.addFile('file:///cache/audio/x.mp3', 10);
    mockFs.addFile('file:///cache/audio/y.mp3', 20);
    const freed = await emptyDirectory('file:///cache/audio/', (e) => e.name === 'x.mp3');
    expect(freed).toBe(20);
    expect(mockFs.has('file:///cache/audio/x.mp3')).toBe(true);
  });
});

describe('buildStorageBreakdown', () => {
  it('should group event files, transcripts, tracks and orphans under other', () => {
    const b = buildStorageBreakdown({
      cache: 1, downloads: 2, videos: 3, publications: 4,
      eventFiles: 5, transcripts: 6, tracks: 7, orphanedDownloads: 8,
    });
    expect(b.other).toBe(26);
    expect(b.total).toBe(36);
  });
});

describe('getBarSegments', () => {
  it('should return no segments when nothing is stored', () => {
    expect(getBarSegments({ cache: 0, downloads: 0, videos: 0, publications: 0, other: 0, total: 0 })).toEqual([]);
  });

  it('should size segments by their share of the total and drop empty ones', () => {
    const segments = getBarSegments({ cache: 25, downloads: 0, videos: 75, publications: 0, other: 0, total: 100 });
    expect(segments).toEqual([
      { key: 'cache', percent: 25 },
      { key: 'videos', percent: 75 },
    ]);
  });
});
