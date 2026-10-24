import type { createFakeFileSystem } from '../../__mocks__/fakeFileSystem';

jest.mock('expo-file-system/legacy', () => {
  const fake = require('../../__mocks__/fakeFileSystem').createFakeFileSystem();
  return {
    ...fake,
    createDownloadResumable: jest.fn((_url: string, path: string) => ({
      downloadAsync: async () => {
        fake.addFile(path, 5_000);
        return { uri: path };
      },
    })),
  };
});
jest.mock('@/services/apiService', () => ({
  __esModule: true,
  default: { get: jest.fn(async () => ({ success: true, data: { url: 'https://cdn/v.mp4' } })) },
}));

import videoDownloadService from '@/services/videoDownloadService';

const fs = jest.requireMock('expo-file-system/legacy') as ReturnType<typeof createFakeFileSystem>;

beforeEach(async () => {
  await fs.deleteAsync('file:///doc/videos');
});

describe('videoDownloadService offline list', () => {
  it('should list a downloaded video with the title stored at download time', async () => {
    await videoDownloadService.download(7, '720p', undefined, { title: 'Evening talk', eventTitle: 'Spring Retreat' });

    const list = await videoDownloadService.listDownloads();

    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ videoId: 7, size: 5_000, title: 'Evening talk', eventTitle: 'Spring Retreat' });
  });

  it('should list videos downloaded before titles were stored without a title', async () => {
    fs.addFile('file:///doc/videos/video-3.mp4', 9_000, 1);

    const list = await videoDownloadService.listDownloads();

    expect(list).toEqual([expect.objectContaining({ videoId: 3, size: 9_000 })]);
    expect(list[0].title).toBeUndefined();
  });

  it('should ignore files that are not event videos', async () => {
    fs.addFile('file:///doc/videos/notes.txt', 10, 1);
    expect(await videoDownloadService.listDownloads()).toEqual([]);
  });

  it('should drop the file and its stored title when the video is deleted', async () => {
    await videoDownloadService.download(7, '720p', undefined, { title: 'Evening talk' });
    await videoDownloadService.delete(7);

    expect(await videoDownloadService.listDownloads()).toEqual([]);
    fs.addFile('file:///doc/videos/video-7.mp4', 1, 1);
    expect((await videoDownloadService.listDownloads())[0].title).toBeUndefined();
  });
});
