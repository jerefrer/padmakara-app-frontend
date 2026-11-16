/**
 * Lets `for await` read a ReadableStream where the browser cannot.
 *
 * pdf.js reads a page's text with `for await (const value of stream)`, and
 * Safari (26.3 at least) has no async iterator on ReadableStream: every page's
 * text layer threw and the web PDF viewer fell over. Its legacy build does not
 * cover this either. Browsers that have it keep their own.
 */
export function installReadableStreamAsyncIterator(proto: object | undefined): void {
  if (!proto || Symbol.asyncIterator in proto) return;
  Object.defineProperty(proto, Symbol.asyncIterator, {
    configurable: true,
    writable: true,
    value: async function* streamChunks(this: ReadableStream) {
      const reader = this.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) return;
          yield value;
        }
      } finally {
        reader.releaseLock();
      }
    },
  });
}
