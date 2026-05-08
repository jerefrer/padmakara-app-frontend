/**
 * Tiny concurrency-limited promise runner. Used by syncService to
 * prefetch changed entity details in the background without flooding
 * the network or backend (default: 3 in flight).
 */

export interface PrefetchQueueOptions {
  concurrency: number;
}

export class PrefetchQueue {
  private concurrency: number;

  constructor(opts: PrefetchQueueOptions) {
    if (opts.concurrency < 1) {
      throw new Error("concurrency must be >= 1");
    }
    this.concurrency = opts.concurrency;
  }

  /** Run all tasks; resolves when all are done. Rejects on first error.
   * Results are returned in completion order (not input order). */
  async addAll<T>(tasks: Array<() => Promise<T>>): Promise<T[]> {
    const results: T[] = [];
    let cursor = 0;

    const worker = async () => {
      while (true) {
        const i = cursor++;
        if (i >= tasks.length) return;
        const value = await tasks[i]();
        results.push(value);
      }
    };

    const workers = Array.from({ length: Math.min(this.concurrency, tasks.length) }, worker);
    await Promise.all(workers);
    return results;
  }

  /** Run all tasks; never rejects — returns Promise.allSettled-style results
   * in completion order. */
  async addAllSettled<T>(tasks: Array<() => Promise<T>>): Promise<PromiseSettledResult<T>[]> {
    const results: PromiseSettledResult<T>[] = [];
    let cursor = 0;

    const worker = async () => {
      while (true) {
        const i = cursor++;
        if (i >= tasks.length) return;
        try {
          const value = await tasks[i]();
          results.push({ status: "fulfilled", value });
        } catch (reason) {
          results.push({ status: "rejected", reason });
        }
      }
    };

    const workers = Array.from({ length: Math.min(this.concurrency, tasks.length) }, worker);
    await Promise.all(workers);
    return results;
  }
}

export default new PrefetchQueue({ concurrency: 3 });
