/**
 * Turns a server-provided filename into one that is safe to use as a single
 * path segment on the device: path separators, control characters and the
 * characters iOS rejects become "-", and leading dots are dropped so the name
 * can be neither hidden nor a parent-directory reference. The extension is
 * kept. Returns `fallback` when nothing usable remains.
 */
export function safeFilename(name: string | undefined, fallback: string): string {
  const cleaned = (name ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .trim()
    .replace(/^\.+/, '');
  return cleaned || fallback;
}
