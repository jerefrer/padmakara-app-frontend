import { PrefetchQueue } from "../../services/prefetchQueue";

describe("PrefetchQueue", () => {
  it("runs all tasks and respects the concurrency limit", async () => {
    const concurrency = 3;
    const queue = new PrefetchQueue({ concurrency });

    let active = 0;
    let maxObserved = 0;

    const makeTask = (delay: number) => async () => {
      active++;
      maxObserved = Math.max(maxObserved, active);
      await new Promise((r) => setTimeout(r, delay));
      active--;
      return delay;
    };

    const tasks = [10, 20, 15, 5, 25, 12, 8].map((d) => makeTask(d));
    const results = await queue.addAll(tasks);

    expect(results.sort((a, b) => a - b)).toEqual([5, 8, 10, 12, 15, 20, 25]);
    expect(maxObserved).toBeLessThanOrEqual(concurrency);
  });

  it("collects errors without aborting other tasks", async () => {
    const queue = new PrefetchQueue({ concurrency: 2 });

    const tasks = [
      async () => "ok-1",
      async () => {
        throw new Error("boom");
      },
      async () => "ok-2",
    ];

    const results = await queue.addAllSettled(tasks);
    expect(results).toHaveLength(3);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
  });
});
