jest.mock('react-pdf', () => ({
  Document: () => null,
  Page: () => null,
  pdfjs: { version: '9.9.9', GlobalWorkerOptions: {} },
}));
jest.mock('react-pdf/dist/Page/TextLayer.css', () => ({}), { virtual: true });

import { PDF_DOCUMENT_OPTIONS } from '@/components/PDFViewerWebImpl';

describe('PDF_DOCUMENT_OPTIONS', () => {
  it('should point pdf.js at its wasm decoders when a PDF holds JBIG2 images', () => {
    expect(PDF_DOCUMENT_OPTIONS.wasmUrl).toBe('https://cdn.jsdelivr.net/npm/pdfjs-dist@9.9.9/wasm/');
  });

  it('should load font data from the same pinned version', () => {
    expect(PDF_DOCUMENT_OPTIONS.cMapUrl).toBe('https://cdn.jsdelivr.net/npm/pdfjs-dist@9.9.9/cmaps/');
    expect(PDF_DOCUMENT_OPTIONS.standardFontDataUrl).toBe(
      'https://cdn.jsdelivr.net/npm/pdfjs-dist@9.9.9/standard_fonts/',
    );
  });
});
