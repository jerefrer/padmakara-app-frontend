import React, { createRef } from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

import type { PDFViewerHandle } from '@/components/PDFViewer.types';

// react-pdf is replaced by a Document that records its props, so the test can
// play pdf.js's part: report the loaded document.
const documentProps: { current: any } = { current: null };
jest.mock('react-pdf', () => ({
  Document: (props: any) => {
    documentProps.current = props;
    return props.children ?? null;
  },
  Page: () => null,
  pdfjs: { version: '9.9.9', GlobalWorkerOptions: {} },
}));
jest.mock('react-pdf/dist/Page/TextLayer.css', () => ({}), { virtual: true });
jest.mock('react-pdf/dist/Page/AnnotationLayer.css', () => ({}), { virtual: true });
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: (props: any) => <Text>{props.name}</Text> };
});
jest.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: () => undefined, language: 'en' }),
}));

import PDFViewerWebImpl from '@/components/PDFViewerWebImpl';

const fakePdf = (numPages: number, outline: unknown = null) => ({
  numPages,
  getPage: async () => ({ getViewport: () => ({ width: 595, height: 842 }) }),
  getOutline: async () => outline,
  getDestination: async () => null,
  getPageIndex: async (ref: { num: number }) => ref.num,
});

// The jest-expo environment has no DOM; the viewer only subscribes to
// fullscreen and key events on it, which these tests do not exercise.
const domEvents = { addEventListener: jest.fn(), removeEventListener: jest.fn() };
beforeAll(() => {
  (globalThis as any).document = { ...domEvents, fullscreenElement: null };
  if (typeof (globalThis as any).window.addEventListener !== 'function') {
    Object.assign((globalThis as any).window, domEvents);
  }
});

afterAll(() => {
  delete (globalThis as any).document;
});

beforeEach(() => {
  documentProps.current = null;
  window.localStorage?.clear?.();
});

async function load(pdf: ReturnType<typeof fakePdf>) {
  await act(async () => {
    await documentProps.current.onLoadSuccess(pdf);
  });
}

describe('PDFViewerWebImpl — opening where the reader left off', () => {
  it('should open on the page to resume in continuous mode', async () => {
    const onPageChange = jest.fn();
    const { getByText } = render(<PDFViewerWebImpl source="blob:test" initialPage={12} onPageChange={onPageChange} />);

    await load(fakePdf(40));

    expect(getByText('12 / 40')).toBeTruthy();
    expect(onPageChange).toHaveBeenLastCalledWith(12, 40);
    expect(onPageChange).not.toHaveBeenCalledWith(1, 40);
  });

  it('should open on the spread holding the page to resume in two-page mode', async () => {
    const { getByText, getByLabelText } = render(<PDFViewerWebImpl source="blob:test" initialPage={13} />);
    fireEvent.press(getByLabelText('View options'));
    fireEvent.press(getByLabelText('Two pages'));

    await load(fakePdf(40));

    expect(getByText('12–13 / 40')).toBeTruthy();
  });

  it('should open on the page to resume in single-page mode', async () => {
    const { getByText, getByLabelText } = render(<PDFViewerWebImpl source="blob:test" initialPage={12} />);
    fireEvent.press(getByLabelText('View options'));
    fireEvent.press(getByLabelText('Single page'));

    await load(fakePdf(40));

    expect(getByText('12 / 40')).toBeTruthy();
  });

  it('should open on the last page when the page to resume is past the end', async () => {
    const { getByText } = render(<PDFViewerWebImpl source="blob:test" initialPage={90} />);

    await load(fakePdf(40));

    expect(getByText('40 / 40')).toBeTruthy();
  });

  it('should open on the first page without a page to resume', async () => {
    const { getByText } = render(<PDFViewerWebImpl source="blob:test" />);

    await load(fakePdf(40));

    expect(getByText('1 / 40')).toBeTruthy();
  });

  it('should not move the reader when the page to resume changes after the document loaded', async () => {
    const { getByText, rerender } = render(<PDFViewerWebImpl source="blob:test" initialPage={12} />);
    await load(fakePdf(40));

    rerender(<PDFViewerWebImpl source="blob:test" initialPage={30} />);

    expect(getByText('12 / 40')).toBeTruthy();
  });
});

describe('PDFViewerWebImpl — screen controls', () => {
  it('should go to a page through the handle the screen holds', async () => {
    const ref = createRef<PDFViewerHandle>();
    const { getByText } = render(<PDFViewerWebImpl source="blob:test" handleRef={ref} />);
    await load(fakePdf(40));

    act(() => ref.current?.goToPage(25));

    expect(getByText('25 / 40')).toBeTruthy();
  });

  it('should report the table of contents of the document', async () => {
    const onOutline = jest.fn();
    render(<PDFViewerWebImpl source="blob:test" onOutline={onOutline} />);

    await load(fakePdf(40, [{ title: 'Preface', dest: [{ num: 4 }], items: [] }]));

    expect(onOutline).toHaveBeenCalledWith([{ title: 'Preface', page: 5, depth: 0 }]);
  });
});
