import React from 'react';
import { act, render } from '@testing-library/react-native';

import { PDFViewer } from '@/components/PDFViewer.android';

let pdfProps: any;

jest.mock('react-native-pdf', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: (props: any) => {
      pdfProps = props;
      return <View testID="pdf" />;
    },
  };
});
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: (props: any) => <Text>{props.name}</Text> };
});
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));

beforeEach(() => {
  pdfProps = undefined;
});

describe('PDFViewer (Android)', () => {
  it('should pass the source uri to the native viewer without caching', () => {
    render(<PDFViewer source="file:///data/doc.pdf" />);

    expect(pdfProps.source).toEqual({ uri: 'file:///data/doc.pdf', cache: false });
    expect(pdfProps.trustAllCerts).toBe(false);
  });

  it('should hide the loader when the document has loaded', () => {
    const { queryByText } = render(<PDFViewer source="https://example.com/doc.pdf" />);
    expect(queryByText('Loading PDF...')).toBeTruthy();

    act(() => pdfProps.onLoadComplete(3, '/path', { width: 1, height: 1 }));

    expect(queryByText('Loading PDF...')).toBeNull();
  });

  it('should show the error text when the document fails to load', () => {
    const { queryByText, queryByTestId } = render(<PDFViewer source="file:///x.pdf" />);

    act(() => pdfProps.onError(new Error('boom')));

    expect(queryByText('Failed to load PDF')).toBeTruthy();
    expect(queryByText('Loading PDF...')).toBeNull();
    expect(queryByTestId('pdf')).toBeNull();
  });

  it('should report page changes with the total page count', () => {
    const onPageChange = jest.fn();
    render(<PDFViewer source="file:///x.pdf" onPageChange={onPageChange} />);

    act(() => pdfProps.onPageChanged(2, 10));

    expect(onPageChange).toHaveBeenCalledWith(2, 10);
  });
});
