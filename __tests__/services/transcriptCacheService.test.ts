import AsyncStorage from '@react-native-async-storage/async-storage';
import type { createFakeFileSystem } from '../../__mocks__/fakeFileSystem';

jest.mock('expo-file-system/legacy', () =>
  require('../../__mocks__/fakeFileSystem').createFakeFileSystem(),
);

import { transcriptCacheService } from '../../services/transcriptCacheService';

const fs = jest.requireMock('expo-file-system/legacy') as ReturnType<typeof createFakeFileSystem>;

describe('transcriptCacheService container path changes', () => {
  it('should return the file when the container path changed since it was cached', async () => {
    fs.addFile('file:///cache/transcripts/talk.pdf', 100, 1_000);
    await AsyncStorage.setItem(
      '@transcript_cache:metadata',
      JSON.stringify({
        t1: {
          transcriptId: 't1',
          updatedAt: '2026-01-01',
          filePath: 'file:///old-container/Library/Caches/transcripts/talk.pdf',
          fileSize: 100,
          cachedAt: '2026-01-01',
        },
      }),
    );

    expect(await transcriptCacheService.getCached('t1', '2026-01-01')).toBe('file:///cache/transcripts/talk.pdf');
    expect(await transcriptCacheService.getCachedFilePath('t1')).toBe('file:///cache/transcripts/talk.pdf');
  });
});
