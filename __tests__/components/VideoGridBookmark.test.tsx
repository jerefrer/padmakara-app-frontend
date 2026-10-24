import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

import { VideoGrid } from '@/components/VideoGrid';

jest.mock('@/hooks/useDesktopLayout', () => ({ useDesktopLayout: () => ({ isDesktop: false }) }));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => '', language: 'en' }),
}));
jest.mock('expo-image', () => ({ Image: () => null }));

const video = (id: number) =>
  ({
    id, eventId: 1, bunnyVideoId: '', position: id, titleEn: `Video ${id}`, titlePt: null,
    videoDate: null, durationSeconds: 60, posterUrl: null, createdAt: '', updatedAt: '',
  }) as any;

const items = [video(1), video(2)];

describe('VideoGrid bookmark toggle', () => {
  it('should show no toggle when bookmarking is not offered', () => {
    const { queryByTestId } = render(
      <VideoGrid items={items} onPlay={jest.fn()} formatDuration={String} />,
    );
    expect(queryByTestId('video-bookmark-toggle-1')).toBeNull();
  });

  it('should label the toggle by whether the video is bookmarked', () => {
    const { getByTestId } = render(
      <VideoGrid
        items={items}
        onPlay={jest.fn()}
        formatDuration={String}
        isBookmarked={(id) => id === 2}
        onToggleBookmark={jest.fn()}
      />,
    );
    expect(getByTestId('video-bookmark-toggle-1').props.accessibilityLabel).toBe('Bookmark this video');
    expect(getByTestId('video-bookmark-toggle-2').props.accessibilityLabel).toBe('Remove bookmark');
  });

  it('should toggle the bookmark without opening the video', () => {
    const onPlay = jest.fn();
    const onToggleBookmark = jest.fn();
    const { getByTestId } = render(
      <VideoGrid
        items={items}
        onPlay={onPlay}
        formatDuration={String}
        isBookmarked={() => false}
        onToggleBookmark={onToggleBookmark}
      />,
    );

    fireEvent.press(getByTestId('video-bookmark-toggle-1'));

    expect(onToggleBookmark).toHaveBeenCalledWith(items[0]);
    expect(onPlay).not.toHaveBeenCalled();
  });
});
