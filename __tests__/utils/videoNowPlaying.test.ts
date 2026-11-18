import { eventNowPlayingInfo, videoNowPlayingMetadata } from '@/utils/videoNowPlaying';

describe('eventNowPlayingInfo', () => {
  it('should join the teachers and prefer the event artwork', () => {
    const info = eventNowPlayingInfo({
      teachers: [{ name: 'Jigme Khyentse Rinpoche' }, { name: 'Pema Wangyal Rinpoche' }],
      image: { artworkUrl: 'https://api.example/events/1/artwork.jpg' },
      sessions: [{ tracks: [{ speakerArtworkUrl: 'https://api.example/teachers/4/artwork.jpg' }] }],
    });

    expect(info).toEqual({
      teacherNames: 'Jigme Khyentse Rinpoche, Pema Wangyal Rinpoche',
      artworkUrl: 'https://api.example/events/1/artwork.jpg',
    });
  });

  it('should fall back to the speaker artwork of the tracks when the event has none', () => {
    const info = eventNowPlayingInfo({
      sessions: [{ tracks: [] }, { tracks: [{ speakerArtworkUrl: 'https://api.example/teachers/4/artwork.jpg' }] }],
    });

    expect(info.artworkUrl).toBe('https://api.example/teachers/4/artwork.jpg');
    expect(info.teacherNames).toBeUndefined();
  });

  it('should return no artwork when the event has nothing loadable', () => {
    expect(eventNowPlayingInfo(null)).toEqual({ teacherNames: undefined, artworkUrl: null });
  });
});

describe('videoNowPlayingMetadata', () => {
  it('should pick the first loadable artwork and leave out an empty artist', () => {
    const metadata = videoNowPlayingMetadata({
      title: 'Guru Yoga · Part 1',
      artist: undefined,
      artworkCandidates: [null, 'assets_images_icon', 'https://vz.example/1/thumbnail.jpg'],
    });

    expect(metadata).toEqual({ title: 'Guru Yoga · Part 1', artwork: 'https://vz.example/1/thumbnail.jpg' });
  });
});
