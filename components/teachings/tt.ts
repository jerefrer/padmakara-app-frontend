type Vars = Record<string, string | number>;

/** Translate a `teachings.*` key with an English fallback; interpolates {{vars}} in the fallback too. */
export function tt(
  t: (key: string, params?: Record<string, unknown>) => string | undefined,
  key: string,
  fallback: string,
  vars?: Vars,
): string {
  const translated = t(`teachings.${key}`, vars);
  if (translated) return translated;
  if (!vars) return fallback;
  return fallback.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}
