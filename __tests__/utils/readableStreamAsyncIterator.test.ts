import { installReadableStreamAsyncIterator } from '@/utils/readableStreamAsyncIterator';

/** A stream prototype without async iteration, as in Safari 26. */
function makeStreamClass() {
  class FakeStream {
    private released = false;
    constructor(private chunks: string[]) {}
    getReader() {
      const chunks = [...this.chunks];
      return {
        read: async () => (chunks.length ? { done: false, value: chunks.shift() } : { done: true, value: undefined }),
        releaseLock: () => {
          this.released = true;
        },
      };
    }
    get isReleased() {
      return this.released;
    }
  }
  return FakeStream;
}

describe('installReadableStreamAsyncIterator', () => {
  it('should let for await read every chunk of a stream that cannot be iterated', async () => {
    const FakeStream = makeStreamClass();
    installReadableStreamAsyncIterator(FakeStream.prototype);
    const stream = new FakeStream(['a', 'b', 'c']);

    const read: string[] = [];
    for await (const chunk of stream as unknown as AsyncIterable<string>) read.push(chunk);

    expect(read).toEqual(['a', 'b', 'c']);
    expect(stream.isReleased).toBe(true);
  });

  it('should leave a native async iterator alone', () => {
    const native = async function* () {};
    const proto = { [Symbol.asyncIterator]: native };

    installReadableStreamAsyncIterator(proto);

    expect(proto[Symbol.asyncIterator]).toBe(native);
  });

  it('should do nothing where streams do not exist', () => {
    expect(() => installReadableStreamAsyncIterator(undefined)).not.toThrow();
  });
});
