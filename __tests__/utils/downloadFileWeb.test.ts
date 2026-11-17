import { downloadFileWeb } from '@/utils/downloadFileWeb';

describe('downloadFileWeb', () => {
  const link = { href: '', download: '', click: jest.fn() };
  const body = { appendChild: jest.fn(), removeChild: jest.fn() };
  const originalFetch = globalThis.fetch;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;

  beforeEach(() => {
    link.href = '';
    link.download = '';
    (globalThis as any).document = { createElement: jest.fn(() => link), body };
    URL.createObjectURL = jest.fn(() => 'blob:local');
    URL.revokeObjectURL = jest.fn();
  });

  afterEach(() => {
    delete (globalThis as any).document;
    globalThis.fetch = originalFetch;
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  });

  it('should save the fetched file under the given name', async () => {
    globalThis.fetch = jest.fn(async () => ({ ok: true, blob: async () => 'bytes' })) as any;

    await downloadFileWeb('blob:viewer', 'Sādhana de Tārā.pdf');

    expect(globalThis.fetch).toHaveBeenCalledWith('blob:viewer');
    expect(link.download).toBe('Sādhana de Tārā.pdf');
    expect(link.href).toBe('blob:local');
    expect(link.click).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local');
  });

  it('should throw and save nothing when the file cannot be fetched', async () => {
    globalThis.fetch = jest.fn(async () => ({ ok: false, status: 403 })) as any;

    await expect(downloadFileWeb('https://x/a.pdf', 'a.pdf')).rejects.toThrow('403');
    expect(link.click).not.toHaveBeenCalled();
  });
});
