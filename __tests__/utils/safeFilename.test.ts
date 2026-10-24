import { safeFilename } from '@/utils/safeFilename';

describe('safeFilename', () => {
  it('should keep an ordinary filename unchanged', () => {
    expect(safeFilename('As Trinta e Sete Práticas.pdf', 'file-1')).toBe('As Trinta e Sete Práticas.pdf');
  });

  it('should replace path separators so the name cannot point into another directory', () => {
    expect(safeFilename('Prayers 1/2 (EN/PT).pdf', 'file-1')).toBe('Prayers 1-2 (EN-PT).pdf');
    expect(safeFilename('a\\b.pdf', 'file-1')).toBe('a-b.pdf');
  });

  it('should remove leading dots so the file is neither hidden nor a parent reference', () => {
    expect(safeFilename('../secret.pdf', 'file-1')).toBe('-secret.pdf');
    expect(safeFilename('.hidden.pdf', 'file-1')).toBe('hidden.pdf');
  });

  it('should strip control characters and characters iOS file names reject', () => {
    expect(safeFilename('a:b*c?"d<e>f|g\u0001.pdf', 'file-1')).toBe('a-b-c--d-e-f-g-.pdf');
  });

  it('should fall back when the name is missing or nothing usable remains', () => {
    expect(safeFilename(undefined, 'file-7')).toBe('file-7');
    expect(safeFilename('   ', 'file-7')).toBe('file-7');
    expect(safeFilename('...', 'file-7')).toBe('file-7');
  });
});
