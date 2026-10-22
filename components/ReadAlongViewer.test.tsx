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
    await AsyncStorage.setItem('readAlong.textSize.v2', '4');
    const utils = await renderViewer();
    await waitFor(() => expect(wordStyle(utils)).toMatchObject(getReadAlongTextMetrics(4)));
  });

  it('should ignore a size saved by the old 21-36px scale', async () => {
    await AsyncStorage.setItem('readAlong.textSize', '4');
    const utils = await renderViewer();
    expect(wordStyle(utils)).toMatchObject(getReadAlongTextMetrics(DEFAULT_TEXT_SIZE_INDEX));
  });

  it('should enlarge the text and persist the choice when pressing the size button', async () => {
    const utils = await renderViewer();
    fireEvent.press(utils.getByTestId('read-along-size-toggle'));
    await waitFor(() =>
      expect(wordStyle(utils)).toMatchObject(getReadAlongTextMetrics(DEFAULT_TEXT_SIZE_INDEX + 1)),
    );
    await waitFor(async () =>
      expect(await AsyncStorage.getItem('readAlong.textSize.v2')).toBe(String(DEFAULT_TEXT_SIZE_INDEX + 1)),
    );
  });

  it('should wrap to the smallest size when pressed on the largest', async () => {
    await AsyncStorage.setItem('readAlong.textSize.v2', String(MAX_TEXT_SIZE_INDEX));
    const utils = await renderViewer();
    await waitFor(() => expect(wordStyle(utils)).toMatchObject(getReadAlongTextMetrics(MAX_TEXT_SIZE_INDEX)));
    fireEvent.press(utils.getByTestId('read-along-size-toggle'));
    await waitFor(() => expect(wordStyle(utils)).toMatchObject(getReadAlongTextMetrics(0)));
  });
});
