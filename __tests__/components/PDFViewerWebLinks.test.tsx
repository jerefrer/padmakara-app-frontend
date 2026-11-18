import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';

// react-pdf is replaced by a Document that records its props, so the test can
// play pdf.js's part: report the loaded document and follow a link.
const documentProps: { current: any; first: any } = { current: null, first: null };
const pageProps: any[] = [];
jest.mock('react-pdf', () => ({
  Document: (props: any) => {
    documentProps.current = props;
    // react-pdf keeps the onItemClick of its first render (it lives in a ref),
    // so links must be followed through that one.
    documentProps.first ??= props;
    return props.children ?? null;
  },
  Page: (props: any) => {
    pageProps.push(props);
    return null;
  },
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

import PDFViewerWebImpl, { EXTERNAL_LINK_REL } from '@/components/PDFViewerWebImpl';

const fakePdf = (numPages: number) => ({
  numPages,
  getPage: async () => ({ getViewport: () => ({ width: 595, height: 842 }) }),
});

async function renderLoaded(numPages = 10) {
  const onPageChange = jest.fn();
  const screen = render(<PDFViewerWebImpl source="blob:test" onPageChange={onPageChange} />);
  await act(async () => {
    await documentProps.current.onLoadSuccess(fakePdf(numPages));
  });
  return { ...screen, onPageChange };
}

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
  documentProps.first = null;
  pageProps.length = 0;
  window.localStorage?.clear?.();
});

describe('PDFViewerWebImpl links', () => {
  it('should render the annotation layer so the PDF links are clickable', async () => {
    await renderLoaded();

    expect(pageProps.length).toBeGreaterThan(0);
    expect(pageProps.every((props) => props.renderAnnotationLayer === true)).toBe(true);
  });

  it('should open external links in a new tab without access to the app', async () => {
    await renderLoaded();

    expect(documentProps.current.externalLinkTarget).toBe('_blank');
    expect(documentProps.current.externalLinkRel).toBe(EXTERNAL_LINK_REL);
    expect(EXTERNAL_LINK_REL).toContain('noopener');
  });

  it('should go to the target page when an internal link is followed in continuous mode', async () => {
    const { getByText, onPageChange } = await renderLoaded(10);

    act(() => documentProps.first.onItemClick({ pageIndex: 6, pageNumber: 7 }));

    expect(getByText('7 / 10')).toBeTruthy();
    expect(onPageChange).toHaveBeenLastCalledWith(7, 10);
  });

  it('should show the spread holding the target page when an internal link is followed in two-page mode', async () => {
    const { getByText, getByLabelText } = await renderLoaded(10);
    fireEvent.press(getByLabelText('Two pages'));

    act(() => documentProps.first.onItemClick({ pageIndex: 6, pageNumber: 7 }));

    expect(getByText('6–7 / 10')).toBeTruthy();
  });

  it('should draw the target page and its neighbours, keeping the page on screen until it is drawn, in single-page mode', async () => {
    const { getByText, getByLabelText } = await renderLoaded(10);
    fireEvent.press(getByLabelText('Single page'));
    pageProps.length = 0;

    act(() => documentProps.first.onItemClick({ pageIndex: 3, pageNumber: 4 }));

    expect(getByText('4 / 10')).toBeTruthy();
    // Page 1 stays on screen (the mocked page never finishes drawing);
    // page 4 and its neighbours are drawn ahead, nothing else.
    expect([...new Set(pageProps.map((props) => props.pageNumber))].sort((a, b) => a - b)).toEqual([1, 3, 4, 5]);
  });
});
