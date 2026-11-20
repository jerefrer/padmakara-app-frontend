import React, { createRef } from 'react';
import { act, render } from '@testing-library/react-native';

import { PDFViewer } from '@/components/PDFViewer';
import type { PDFViewerHandle } from '@/components/PDFViewer.types';

let pdfProps: any;
let mockPdfMounts = 0;
const mockSetPage = jest.fn();

jest.mock('react-native-pdf', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: React.forwardRef((props: any, ref: any) => {
      pdfProps = props;
      React.useEffect(() => {
        mockPdfMounts += 1;
      }, []);
      React.useImperativeHandle(ref, () => ({ setPage: mockSetPage }));
      return <View testID="pdf" />;
    }),
  };
});
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: (props: any) => <Text>{props.name}</Text> };
});
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));

beforeEach(() => {
  pdfProps = undefined;
  mockPdfMounts = 0;
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

  it('should turn off double-tap zoom so a tap toggles the bars at once', () => {
    render(<PDFViewer source="https://example.com/doc.pdf" />);

    expect(pdfProps.enableDoubleTapZoom).toBe(false);
  });

  it('should leave room above the first page for a bar laid over it', () => {
    render(<PDFViewer source="file:///x.pdf" contentInsetTop={104.6} />);

    expect(pdfProps.contentInsetTop).toBe(105);
  });

  it('should leave no room above the first page by default', () => {
    render(<PDFViewer source="file:///x.pdf" />);

    expect(pdfProps.contentInsetTop).toBe(0);
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

  it('should report a single tap at once', () => {
    const onSingleTap = jest.fn();
    render(<PDFViewer source="file:///x.pdf" onSingleTap={onSingleTap} />);

    act(() => pdfProps.onPageSingleTap(3, 10, 10));

    expect(onSingleTap).toHaveBeenCalledTimes(1);
  });

  it('should undo the tap when it followed an internal link to a distant page', () => {
    const onSingleTap = jest.fn();
    render(<PDFViewer source="file:///x.pdf" onSingleTap={onSingleTap} />);
    act(() => pdfProps.onPageChanged(3, 40));

    act(() => pdfProps.onPageSingleTap(3, 10, 10));
    act(() => pdfProps.onPageChanged(27, 40));

    expect(onSingleTap).toHaveBeenCalledTimes(2);
  });

  it('should keep the tap when the reader scrolls on to the next page', () => {
    const onSingleTap = jest.fn();
    render(<PDFViewer source="file:///x.pdf" onSingleTap={onSingleTap} />);
    act(() => pdfProps.onPageChanged(3, 40));

    act(() => pdfProps.onPageSingleTap(3, 10, 10));
    act(() => pdfProps.onPageChanged(4, 40));

    expect(onSingleTap).toHaveBeenCalledTimes(1);
  });

  it('should keep a tap made long before a page jump', () => {
    const onSingleTap = jest.fn();
    render(<PDFViewer source="file:///x.pdf" onSingleTap={onSingleTap} />);
    act(() => pdfProps.onPageChanged(3, 40));

    act(() => pdfProps.onPageSingleTap(3, 10, 10));
    jest.setSystemTime(Date.now() + 2000);
    act(() => pdfProps.onPageChanged(27, 40));

    expect(onSingleTap).toHaveBeenCalledTimes(1);
  });

  it('should jump to a page through its handle', () => {
    const ref = createRef<PDFViewerHandle>();
    render(<PDFViewer ref={ref} source="file:///x.pdf" />);

    act(() => ref.current?.goToPage(12));

    expect(mockSetPage).toHaveBeenCalledWith(12);
  });

  it('should keep the open document and its page when the reader re-renders after a tap', () => {
    const onSingleTap = jest.fn();
    const { rerender } = render(
      <PDFViewer source="file:///x.pdf" onSingleTap={onSingleTap} contentInsetTop={80} />
    );
    act(() => pdfProps.onPageChanged(12, 40));

    act(() => pdfProps.onPageSingleTap(12, 10, 10));
    rerender(<PDFViewer source="file:///x.pdf" onSingleTap={onSingleTap} contentInsetTop={80} />);

    expect(onSingleTap).toHaveBeenCalledTimes(1);
    expect(mockPdfMounts).toBe(1);
    expect(pdfProps.source).toEqual({ uri: 'file:///x.pdf', cache: false });
    // The page prop stays the one the document opened on: a changing one
    // would send the native reader back to it on every update.
    expect(pdfProps.page).toBe(1);
    expect(mockSetPage).not.toHaveBeenCalled();
  });

  it('should open the document on the page to resume', () => {
    render(<PDFViewer source="file:///x.pdf" initialPage={12} />);

    expect(pdfProps.page).toBe(12);
  });

  it('should keep the page it opened on when the initial page changes later', () => {
    const { rerender } = render(<PDFViewer source="file:///x.pdf" initialPage={12} />);
    act(() => pdfProps.onLoadComplete(40, '/path', { width: 1, height: 1 }));
    act(() => pdfProps.onPageChanged(20, 40));

    rerender(<PDFViewer source="file:///x.pdf" initialPage={30} contentInsetTop={80} />);

    expect(pdfProps.page).toBe(12);
    expect(mockSetPage).not.toHaveBeenCalled();
    expect(mockPdfMounts).toBe(1);
  });

  it('should open on the last page when the page to resume is past the end', () => {
    render(<PDFViewer source="file:///x.pdf" initialPage={50} />);

    act(() => pdfProps.onLoadComplete(30, '/path', { width: 1, height: 1 }));

    expect(mockSetPage).toHaveBeenCalledWith(30);
  });

  it('should open on the first page without a page to resume', () => {
    render(<PDFViewer source="file:///x.pdf" initialPage={null} />);

    act(() => pdfProps.onLoadComplete(30, '/path', { width: 1, height: 1 }));

    expect(pdfProps.page).toBe(1);
    expect(mockSetPage).not.toHaveBeenCalled();
  });

  it('should add no theme layer when the reading theme is normal', () => {
    const screen = render(<PDFViewer source="file:///data/doc.pdf" />);

    expect(screen.queryByTestId('pdf-theme-layer-multiply')).toBeNull();
    expect(screen.queryByTestId('pdf-theme-layer-difference')).toBeNull();
  });

  it('should multiply the page by the paper colour when the theme is sepia', () => {
    const screen = render(<PDFViewer source="file:///data/doc.pdf" readingTheme="sepia" />);

    expect(screen.getByTestId('pdf-theme-layer-multiply').props.pointerEvents).toBe('none');
  });

  it('should invert the page when the theme is night', () => {
    const screen = render(<PDFViewer source="file:///data/doc.pdf" readingTheme="night" />);

    expect(screen.getByTestId('pdf-theme-layer-difference')).toBeTruthy();
  });

  it('should place the page counter below the reader bar', () => {
    const screen = render(<PDFViewer source="file:///data/doc.pdf" contentInsetTop={90} />);
    act(() => pdfProps.onPageChanged(5, 442));

    const badge = screen.getByText('5 / 442').parent!.parent!;
    expect(JSON.stringify(badge.props.style)).toContain('"top":98');
  });
});
