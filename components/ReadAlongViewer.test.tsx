import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { ReadAlongViewer } from '@/components/ReadAlongViewer';
import { getReadAlongTextMetrics, DEFAULT_TEXT_SIZE_INDEX, MAX_TEXT_SIZE_INDEX } from '@/services/readAlongPreferencesService';

jest.mock('@/contexts/AudioPlayerContext', () => ({
  useAudioPlayerContext: () => ({
    position: 1,
    isPlaying: false,
    seekTo: jest.fn(),
    player: null,
  }),
}));

jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

const data: any = {
  clean_segments: [
    {
      start: 0,
      end: 3,
      words: [
        { word: 'Hello', start: 0, end: 1 },
        { word: 'world', start: 1, end: 2 },
      ],
    },
  ],
};

const flatten = (style: any): Record<string, any> =>
  Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean).map(flatten)) : style || {};

const wordStyle = (utils: ReturnType<typeof render>) => flatten(utils.getByText('Hello').props.style);

const renderViewer = async () => {
  const utils = render(<ReadAlongViewer readAlongData={data} onClose={jest.fn()} />);
  await act(async () => {});
  return utils;
};

describe('ReadAlongViewer text size', () => {
  it('should render words at the default size when nothing is saved', async () => {
    const utils = await renderViewer();
    const expected = getReadAlongTextMetrics(DEFAULT_TEXT_SIZE_INDEX);
    expect(wordStyle(utils)).toMatchObject(expected);
  });

  it('should render words at the saved size', async () => {
    await AsyncStorage.setItem('readAlong.textSize', '4');
    const utils = await renderViewer();
    await waitFor(() => expect(wordStyle(utils)).toMatchObject(getReadAlongTextMetrics(4)));
  });

  it('should enlarge the text and persist the choice when tapping larger', async () => {
    const utils = await renderViewer();
    fireEvent.press(utils.getByTestId('read-along-size-toggle'));
    fireEvent.press(utils.getByTestId('read-along-size-larger'));
    await waitFor(() =>
      expect(wordStyle(utils)).toMatchObject(getReadAlongTextMetrics(DEFAULT_TEXT_SIZE_INDEX + 1)),
    );
    await waitFor(async () =>
      expect(await AsyncStorage.getItem('readAlong.textSize')).toBe(String(DEFAULT_TEXT_SIZE_INDEX + 1)),
    );
  });

  it('should not go below the smallest step', async () => {
    await AsyncStorage.setItem('readAlong.textSize', '0');
    const utils = await renderViewer();
    fireEvent.press(utils.getByTestId('read-along-size-toggle'));
    fireEvent.press(utils.getByTestId('read-along-size-smaller'));
    await act(async () => {});
    expect(wordStyle(utils)).toMatchObject(getReadAlongTextMetrics(0));
  });

  it('should not go above the largest step', async () => {
    await AsyncStorage.setItem('readAlong.textSize', String(MAX_TEXT_SIZE_INDEX));
    const utils = await renderViewer();
    fireEvent.press(utils.getByTestId('read-along-size-toggle'));
    fireEvent.press(utils.getByTestId('read-along-size-larger'));
    await act(async () => {});
    expect(wordStyle(utils)).toMatchObject(getReadAlongTextMetrics(MAX_TEXT_SIZE_INDEX));
  });
});
