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

import PDFViewerWebImpl from '@/components/PDFViewerWebImpl';

const fakePdf = (numPages: number) => ({
  numPages,
  getPage: async () => ({ getViewport: () => ({ width: 595, height: 842 }) }),
});

async function renderLoaded(numPages = 10, extra: Record<string, unknown> = {}) {
  const onPageChange = jest.fn();
  const screen = render(<PDFViewerWebImpl source="blob:test" onPageChange={onPageChange} {...extra} />);
  await act(async () => {
    await documentProps.current.onLoadSuccess(fakePdf(numPages));
  });
  return { ...screen, onPageChange };
}

// The jest-expo environment has no DOM; the viewer only subscribes to
// fullscreen and key events on it, which these tests do not exercise.
const domEvents = { addEventListener: jest.fn(), removeEventListener: jest.fn() };
beforeAll(() => {
  (globalThis as any).document = { ...domEvents, fullscreenElement: null, documentElement: {} };
  if (typeof (globalThis as any).window.addEventListener !== 'function') {
    Object.assign((globalThis as any).window, domEvents);
  }
});

afterAll(() => {
  delete (globalThis as any).document;
});

beforeEach(() => {
  (globalThis as any).document.documentElement = {};
  (globalThis as any).document.fullscreenEnabled = undefined;
  documentProps.current = null;
  documentProps.first = null;
  pageProps.length = 0;
  window.localStorage?.clear?.();
});


const click = (screen: ReturnType<typeof render>, event: Record<string, unknown> = {}) => {
  const area = screen.UNSAFE_root.findAll((n: any) => typeof n.type === 'string' && typeof n.props.onClick === 'function' && typeof n.props.onPointerDown === 'function')[0];
  (globalThis as any).window.getSelection = () => ({ toString: () => (event.selected as string) ?? '' });
  act(() => {
    area.props.onPointerDown?.({ clientX: 50, clientY: 50 });
    area.props.onClick({
      target: event.target ?? { closest: () => null },
      clientX: event.clientX ?? 50,
      clientY: event.clientY ?? 50,
      metaKey: false, ctrlKey: false, shiftKey: false, altKey: false,
    });
  });
};

describe('PDFViewerWebImpl tap to hide the bars', () => {
  it('should call onSingleTap when the page is clicked', async () => {
    const onSingleTap = jest.fn();
    const screen = await renderLoaded(10, { onSingleTap, fullWindow: true });
    click(screen);
    expect(onSingleTap).toHaveBeenCalledTimes(1);
  });

  it('should not call onSingleTap for a click on a link', async () => {
    const onSingleTap = jest.fn();
    const screen = await renderLoaded(10, { onSingleTap, fullWindow: true });
    click(screen, { target: { closest: () => ({}) } });
    expect(onSingleTap).not.toHaveBeenCalled();
  });

  it('should not call onSingleTap when text is selected or the pointer dragged', async () => {
    const onSingleTap = jest.fn();
    const screen = await renderLoaded(10, { onSingleTap, fullWindow: true });
    click(screen, { selected: 'some words' });
    click(screen, { clientY: 200 });
    expect(onSingleTap).not.toHaveBeenCalled();
  });

  it('should fade the toolbar out with the reader bars', async () => {
    const screen = await renderLoaded(10, { fullWindow: true, barsHidden: true, onSingleTap: jest.fn() });
    const toolbar = screen.getByTestId('pdf-web-toolbar', { includeHiddenElements: true });
    expect(toolbar.props.pointerEvents).toBe('none');
    const style = Object.assign({}, ...[toolbar.props.style].flat(Infinity).filter(Boolean));
    expect(style.opacity).toBe(0);
  });

  it('should hide the fullscreen button where the browser cannot do fullscreen', async () => {
    const screen = await renderLoaded(10, { fullWindow: true });
    expect(screen.queryByLabelText('Enter fullscreen')).toBeNull();
  });

  it('should offer fullscreen where the browser can', async () => {
    (globalThis as any).document.documentElement = { requestFullscreen: jest.fn() };
    (globalThis as any).document.fullscreenEnabled = true;
    const screen = await renderLoaded(10, { fullWindow: true });
    expect(screen.getByLabelText('Enter fullscreen')).toBeTruthy();
  });
});
