import React, { createRef } from 'react';
import { act, render } from '@testing-library/react-native';

import { PDFViewer } from '@/components/PDFViewer';
import type { PDFViewerHandle } from '@/components/PDFViewer.types';

let pdfProps: any;
const mockSetPage = jest.fn();

jest.mock('react-native-pdf', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: React.forwardRef((props: any, ref: any) => {
      pdfProps = props;
      React.useImperativeHandle(ref, () => ({ setPage: mockSetPage }));
      return <View testID="pdf" />;
    }),
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
  mockSetPage.mockClear();
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('PDFViewer (iOS and Android)', () => {
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

  it('should report the table of contents once the document has loaded', () => {
    const onOutline = jest.fn();
    render(<PDFViewer source="file:///x.pdf" onOutline={onOutline} />);

    act(() =>
      pdfProps.onLoadComplete(20, '/path', { width: 1, height: 1 }, [
        { title: 'Part one', pageIdx: '4', children: [] },
      ])
    );

    expect(onOutline).toHaveBeenCalledWith([{ title: 'Part one', page: 5, depth: 0 }]);
  });

  it('should report a single tap after a short delay', () => {
    const onSingleTap = jest.fn();
    render(<PDFViewer source="file:///x.pdf" onSingleTap={onSingleTap} />);

    act(() => pdfProps.onPageSingleTap(3, 10, 10));
    expect(onSingleTap).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(400));
    expect(onSingleTap).toHaveBeenCalledTimes(1);
  });

  it('should not report a tap that followed an internal link to another page', () => {
    const onSingleTap = jest.fn();
    render(<PDFViewer source="file:///x.pdf" onSingleTap={onSingleTap} />);
    act(() => pdfProps.onPageChanged(3, 40));

    act(() => pdfProps.onPageSingleTap(3, 10, 10));
    act(() => pdfProps.onPageChanged(27, 40));
    act(() => jest.advanceTimersByTime(400));

    expect(onSingleTap).not.toHaveBeenCalled();
  });

  it('should jump to a page through its handle', () => {
    const ref = createRef<PDFViewerHandle>();
    render(<PDFViewer ref={ref} source="file:///x.pdf" />);

    act(() => ref.current?.goToPage(12));

    expect(mockSetPage).toHaveBeenCalledWith(12);
  });
});
