const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * How long the native splash stays up while the app warms its caches.
 *
 * At least `minMs`, so the brand screen is actually seen (it used to vanish
 * as soon as fonts loaded); at most `maxMs`, so a slow network never holds
 * the user behind it. In between, it lifts as soon as the work is done. A
 * failed warm-up lifts it too: the screens fall back to their own loading.
 */
export async function holdSplashWhile(
  work: () => Promise<unknown>,
  { minMs, maxMs }: { minMs: number; maxMs: number },
): Promise<void> {
  const settled = work().then(
    () => undefined,
    () => undefined,
  );
  await Promise.race([Promise.all([settled, sleep(minMs)]), sleep(maxMs)]);
}
