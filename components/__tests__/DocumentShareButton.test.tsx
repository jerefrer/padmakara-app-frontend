import React from 'react';
import { Platform } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

import { DocumentShareButton, sanitizePdfFilename } from '@/components/DocumentShareButton';

jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: (key: string) => key }),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  makeDirectoryAsync: jest.fn(() => Promise.resolve()),
  deleteAsync: jest.fn(() => Promise.resolve()),
  copyAsync: jest.fn(() => Promise.resolve()),
}));

const isAvailable = Sharing.isAvailableAsync as jest.Mock;
const shareAsync = Sharing.shareAsync as jest.Mock;
const copyAsync = FileSystem.copyAsync as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  isAvailable.mockResolvedValue(true);
  shareAsync.mockResolvedValue(undefined);
});

describe('DocumentShareButton', () => {
  it('should share the viewed file path when the button is pressed', async () => {
    const path = 'file:///cache/event-files/Practice.pdf';
    const { findByLabelText } = render(
      <DocumentShareButton filePath={path} filename="Practice.pdf" onError={jest.fn()} />
    );
    fireEvent.press(await findByLabelText('documents.share'));
    await waitFor(() => expect(shareAsync).toHaveBeenCalledTimes(1));
    expect(shareAsync).toHaveBeenCalledWith(path, expect.objectContaining({ mimeType: 'application/pdf' }));
    expect(copyAsync).not.toHaveBeenCalled();
  });

  it('should copy to a sanitized .pdf name when the local file name is not proper', async () => {
    const { findByLabelText } = render(
      <DocumentShareButton filePath="file:///cache/event-files/file-12" filename="Notes: day 1.pdf" onError={jest.fn()} />
    );
    fireEvent.press(await findByLabelText('documents.share'));
    await waitFor(() => expect(shareAsync).toHaveBeenCalled());
    expect(copyAsync).toHaveBeenCalledWith({
      from: 'file:///cache/event-files/file-12',
      to: 'file:///cache/event-files/share/Notes- day 1.pdf',
    });
    expect(shareAsync.mock.calls[0][0]).toBe('file:///cache/event-files/share/Notes- day 1.pdf');
  });

  it('should render nothing when sharing is unavailable', async () => {
    isAvailable.mockResolvedValue(false);
    const { queryByLabelText } = render(
      <DocumentShareButton filePath="file:///a.pdf" filename="a.pdf" onError={jest.fn()} />
    );
    await waitFor(() => expect(isAvailable).toHaveBeenCalled());
    expect(queryByLabelText('documents.share')).toBeNull();
  });

  it('should render nothing on web', async () => {
    const original = Platform.OS;
    (Platform as any).OS = 'web';
    try {
      const { queryByLabelText } = render(
        <DocumentShareButton filePath="blob:x" filename="a.pdf" onError={jest.fn()} />
      );
      expect(queryByLabelText('documents.share')).toBeNull();
      expect(isAvailable).not.toHaveBeenCalled();
    } finally {
      (Platform as any).OS = original;
    }
  });

  it('should call onError when sharing fails', async () => {
    shareAsync.mockRejectedValue(new Error('boom'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const onError = jest.fn();
    const { findByLabelText } = render(
      <DocumentShareButton filePath="file:///cache/event-files/a.pdf" filename="a.pdf" onError={onError} />
    );
    fireEvent.press(await findByLabelText('documents.share'));
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
  });
});

describe('sanitizePdfFilename', () => {
  it('should strip forbidden characters and ensure a .pdf extension', () => {
    expect(sanitizePdfFilename('a/b:c')).toBe('a-b-c.pdf');
    expect(sanitizePdfFilename('Guide.PDF')).toBe('Guide.pdf');
    expect(sanitizePdfFilename('  ')).toBe('document.pdf');
  });
});
