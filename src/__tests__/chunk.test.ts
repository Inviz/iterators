import { describe, expect, it } from 'vitest';
import { chunk } from '..';
import { writer } from '../lib/writer';

// Helper to create a delay function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe.concurrent('chunk', () => {
  it.concurrent('should chunk elements into arrays of specified size', async () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const size = 3;

    const result: number[][] = [];
    for await (const c of chunk(input, size)) {
      result.push(c);
    }

    expect(result).toEqual([[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]]);
  });

  it.concurrent('should handle empty input', async () => {
    const input: number[] = [];
    const size = 3;

    const result: number[][] = [];
    for await (const c of chunk(input, size)) {
      result.push(c);
    }

    expect(result).toEqual([]);
  });

  it.concurrent('should handle chunk size equal to input length', async () => {
    const input = [1, 2, 3];
    const size = 3;

    const result: number[][] = [];
    for await (const c of chunk(input, size)) {
      result.push(c);
    }

    expect(result).toEqual([[1, 2, 3]]);
  });

  it.concurrent('should work with the curried version', async () => {
    const input = [1, 2, 3, 4, 5, 6, 7];
    const chunker = chunk<number>(2);

    const result: number[][] = [];
    for await (const c of chunker(input)) {
      result.push(c);
    }

    expect(result).toEqual([[1, 2], [3, 4], [5, 6], [7]]);
  });

  it.concurrent('should not process anything for chunk size <= 0', async () => {
    const input = [1, 2, 3, 4, 5];

    const result: number[][] = [];
    for await (const c of chunk(input, 0)) {
      result.push(c);
    }

    expect(result).toEqual([]);
  });

  it.concurrent('should not block source iterator when accumulating chunks', async () => {
    // Track when values are pulled from the source
    const sourceAccess: number[] = [];

    // Create a slow source iterator
    async function* slowSource() {
      for (let i = 1; i <= 10; i++) {
        sourceAccess.push(i);
        yield i;
      }
    }

    const chunkSize = 3;
    const concurrency = 2;

    // Time when we start consuming chunks
    const startTime = Date.now();

    // Collect chunks
    const result: number[][] = [];
    for await (const c of chunk(slowSource(), chunkSize, concurrency)) {
      console.log('chunk', c);
      result.push(c);

      // Add a delay to simulate slow consumption
      await delay(100);
    }

    const duration = Date.now() - startTime;

    // Without concurrency, this would take:
    // - 10 items from source at 50ms each = 500ms
    // - Plus processing time for collecting chunks
    // - Plus 100ms delay after each chunk (4 chunks) = 400ms
    // Total: ~900ms

    // With proper concurrency, the source should be consumed faster
    expect(duration).toBeLessThan(750);

    // Verify we got all chunks correctly
    expect(result).toEqual([[1, 2, 3], [4, 5, 6], [7, 8, 9], [10]]);

    // Verify the entire source was consumed
    expect(sourceAccess).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it.concurrent('should respect concurrency limits when processing source', async () => {
    // Track active operations
    let activeOperations = 0;
    let maxActiveOperations = 0;

    // Create source that tracks concurrency
    async function* concurrentSource() {
      console.log('source');
      for (let i = 1; i <= 20; i++) {
        activeOperations++;
        maxActiveOperations = Math.max(maxActiveOperations, activeOperations);

        yield i;

        // Simulate work
        await delay(30);
        activeOperations--;
      }
      console.log('done!');
    }

    const chunkSize = 4;
    const concurrencyLimit = 3;

    // Process with limited concurrency
    const result: number[][] = [];
    for await (const c of chunk(concurrentSource(), chunkSize, concurrencyLimit)) {
      console.log('chunk', c);
      result.push(c);
    }

    // Verify we got all chunks correctly
    expect(result.length).toBe(5);
    expect(result[0]).toEqual([1, 2, 3, 4]);
    expect(result[4]).toEqual([17, 18, 19, 20]);

    // Verify concurrency limit was respected
    expect(maxActiveOperations).toBeLessThanOrEqual(concurrencyLimit);
  });

  it.concurrent(
    'should not block on a source that produces values slower than they are consumed',
    async () => {
      // Create a controlled source iterator that only produces values when signaled
      async function* controlledSource() {
        for (let i = 1; i <= 10; i++) {
          yield i;
        }
      }

      const stream = writer();

      // Start chunking with concurrency
      const chunks = chunk(stream, 3, 2);

      // Request the first chunk
      console.log('chunking');
      const firstChunkPromise = chunks.next();
      console.log('chunking');

      // Allow the first 3 values to be produced
      stream.write(1);
      stream.write(2);
      stream.write(3);

      // The first chunk should be generated without waiting for the entire source
      const firstChunkResult = await firstChunkPromise;
      expect(firstChunkResult.value).toEqual([1, 2, 3]);

      // Request the second chunk
      const secondChunkPromise = chunks.next();

      // Allow the next 3 values to be produced
      stream.write(4);
      stream.write(5);
      stream.write(6);

      // The second chunk should be produced
      const secondChunkResult = await secondChunkPromise;
      expect(secondChunkResult.value).toEqual([4, 5, 6]);

      // Complete the iteration to clean up
      stream.write(7);
      stream.write(8);
      stream.write(9);
      stream.write(10);
      stream.end();

      // Consume the remaining chunks
      const remainingChunks: number[][] = [];
      for await (const c of { [Symbol.asyncIterator]: () => chunks }) {
        remainingChunks.push(c);
      }

      expect(remainingChunks).toEqual([[7, 8, 9], [10]]);
    }
  );

  it.concurrent('should handle a source that becomes blocked', async () => {
    // Create a deferred promise that will never resolve
    let neverResolve: () => void;
    const blockingPromise = new Promise<void>(resolve => {
      neverResolve = resolve;
    });

    // Create an async generator that yields a few values then blocks
    async function* blockingIterator() {
      yield 1;
      yield 2;
      yield 3;
      await blockingPromise; // This will block
      yield 4; // This should never be reached
    }

    // Use chunk with concurrency
    const chunker = chunk(blockingIterator(), 2, 2);

    // Collect results with a timeout
    const results: number[][] = [];
    let timedOut = false;

    // Set up a timeout promise
    const timeoutPromise = new Promise<void>(resolve => {
      setTimeout(() => {
        timedOut = true;
        resolve();
      }, 200);
    });

    // Try to get chunks until timeout
    while (!timedOut) {
      const resultPromise = chunker.next();
      await Promise.race([resultPromise, timeoutPromise]);

      if (timedOut) break;

      const result = await resultPromise;
      if (result.done) break;

      results.push(result.value);
    }

    // Should get at least the first chunk with values [1, 2]
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toEqual([1, 2]);

    // Clean up to prevent test from hanging
    neverResolve();
  });
});
