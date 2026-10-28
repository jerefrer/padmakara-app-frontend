/**
 * Accepts only an internal absolute path ("/(tabs)/search", "/retreat/3?x=1"). Anything else
 * (another host, a scheme, "//host", backslashes, whitespace or control characters) becomes
 * `fallback`, so a crafted `next` or `returnTo` can never send the person elsewhere.
 */
export function safeInternalPath(value: unknown, fallback = '/(tabs)'): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2000) return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  if (/[\\\s\u0000-\u001f\u007f]/.test(value)) return fallback;
  return value;
}
