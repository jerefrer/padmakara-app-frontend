import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

jest.mock('react-pdf', () => ({
  Document: (props: any) => props.children ?? null,
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
import { colors } from '@/constants/colors';

// No DOM in the jest-expo environment: the viewer only needs event
// subscriptions and localStorage from it.
const store = new Map<string, string>();
const domEvents = { addEventListener: jest.fn(), removeEventListener: jest.fn() };
beforeAll(() => {
  (globalThis as any).document = { ...domEvents, fullscreenElement: null };
  if (typeof (globalThis as any).window.addEventListener !== 'function') {
    Object.assign((globalThis as any).window, domEvents);
  }
  Object.defineProperty((globalThis as any).window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    },
  });
});
afterAll(() => {
  delete (globalThis as any).document;
});
beforeEach(() => store.clear());

/** The scrolling area carries the theme attribute the canvas filters key on. */
function scroller(screen: ReturnType<typeof render>) {
  return screen.UNSAFE_root.find((node) => node.type === 'div' && 'data-reading-theme' in node.props);
}

describe('PDFViewerWebImpl reading theme', () => {
  it('should start in the normal theme on a white ground', () => {
    const screen = render(<PDFViewerWebImpl source="blob:test" />);

    expect(scroller(screen).props['data-reading-theme']).toBe('normal');
    expect(scroller(screen).props.style.backgroundColor).toBe(colors.white);
  });

  it('should switch to night with a dark ground and remember the choice', () => {
    const screen = render(<PDFViewerWebImpl source="blob:test" />);

    fireEvent.press(screen.getByLabelText('Night (negative)'));

    expect(scroller(screen).props['data-reading-theme']).toBe('night');
    expect(scroller(screen).props.style.backgroundColor).toBe(colors.reader.nightGround);
    expect(store.get('@pdfViewer:theme')).toBe('night');
  });

  it('should reopen in the remembered theme', () => {
    store.set('@pdfViewer:theme', 'sepia');

    const screen = render(<PDFViewerWebImpl source="blob:test" />);

    expect(scroller(screen).props['data-reading-theme']).toBe('sepia');
    expect(scroller(screen).props.style.backgroundColor).toBe(colors.reader.sepiaGround);
  });
});
