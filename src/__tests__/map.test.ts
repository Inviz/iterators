import { describe, expect, it, vi } from 'vitest';
import { map } from '..';

// Helper to create a delay function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe.concurrent('map', () => {
  it.concurrent('should process items concurrently with limited concurrency', async () => {
    const processed: number[] = [];
    const processingTimes: number[] = [];

    // Create processing function that takes different times
    const processFn = async (item: number) => {
      const startTime = Date.now();
      await delay(item * 10); // Item 1 takes 10ms, item 2 takes 20ms, etc.
      const endTime = Date.now();
      processed.push(item);
      processingTimes.push(endTime - startTime);
      return item * 2;
    };

    // Source items
    const items = [3, 1, 4, 2, 5];

    // Process with concurrency of 2
    const results: number[] = [];
    for await (const result of map(items, processFn, 2)) {
      results.push(result);
    }

    // We should get all results, but potentially in a different order
    expect(results.sort((a, b) => a - b)).toEqual([2, 4, 6, 8, 10]);

    // We should have processed all items
    expect(processed.length).toBe(5);

    // With concurrency of 2, we should not have processed all items sequentially
    const totalTime = processingTimes.reduce((sum, time) => sum + time, 0);
    const maxTime = Math.max(...processingTimes) * 5; // If all were processed sequentially

    // Total processing time should be less than if all were processed sequentially
    expect(totalTime).toBeLessThan(maxTime);
  });

  it.concurrent('should create a function that processes with limited concurrency', async () => {
    const processFn = vi.fn().mockImplementation(async (x: number) => {
      await delay(200);
      return x * 2;
    });

    const concurrentProcess = map(processFn, 3);

    const items = [1, 2, 3, 4, 5];
    const results: number[] = [];
    const startTime = Date.now();

    for await (const result of concurrentProcess(items)) {
      results.push(result);
    }
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(500); // Does 2x200ms bursts of 3 and 2 items, each burst is 200ms
    expect(results.sort((a, b) => a - b)).toEqual([2, 4, 6, 8, 10]);
    expect(processFn).toHaveBeenCalledTimes(5);
  });

  it.concurrent('should work with synchronous iterables', async () => {
    const processFn = vi.fn().mockImplementation(async (x: number) => {
      await delay(100);
      return x * 2;
    });

    const concurrentProcess = map(processFn, 2);

    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const results: number[] = [];
    const startTime = Date.now();

    for await (const result of concurrentProcess(items)) {
      results.push(result);
      if (results.length == 4) {
        break;
      }
    }

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(300); // Should take ~200ms with concurrency of 2
    expect(results.sort()).toEqual([2, 4, 6, 8]);
    expect(processFn).toHaveBeenCalledTimes(6); // 4 real and  2 eagerly produced result
  });

  it.concurrent('should support composing concurrent operations', async () => {
    // First processor doubles numbers with concurrency of 2
    const processFn1 = vi.fn().mockImplementation(async (x: number) => {
      await delay(100);
      return x * 2;
    });

    // Second processor adds 10 to numbers with concurrency of 3
    const processFn2 = vi.fn().mockImplementation(async (x: number) => {
      await delay(100);
      return x + 10;
    });

    const firstConcurrent = map(processFn1, 2);
    const secondConcurrent = map(processFn2, 3);
    var calledTimes = 0;
    async function* generateItems() {
      for (let i = 1; i <= 14; i++) {
        yield i;
        calledTimes++;
      }
    }
    const items = generateItems();
    const results: number[] = [];
    const startTime = Date.now();

    // Chain the concurrent operations
    for await (const result of secondConcurrent(firstConcurrent(items))) {
      results.push(result);
      if (results.length == 5) {
        break;
      }
    }
    // Each function should be called once for each input
    expect(processFn2).toHaveBeenCalledTimes(7); // Step 2 kept its buffer filled, so 2 more items were processed
    expect(processFn1).toHaveBeenCalledTimes(9); // Step 2 requested for 2 more items, and then step 1 also eagerly produced 2 more
    expect(calledTimes).toBe(9); // input generator produced 7  values

    const duration = Date.now() - startTime;

    // With proper concurrency, this should complete in around 400ms
    // (300ms for the first operation in 3 batches, 100ms for the second operation)
    expect(duration).toBeLessThan(500);

    // Items are first doubled, then have 10 added
    expect(results).toEqual([12, 14, 16, 18, 20]);
  });

  it.concurrent('should respect concurrency limit with consumer backpressure', async () => {
    // Track active concurrent operations
    let activeOperations = 0;
    let maxActiveOperations = 0;

    // Create a processing function with tracking
    const processFn = vi.fn().mockImplementation(async (x: number) => {
      activeOperations++;
      maxActiveOperations = Math.max(maxActiveOperations, activeOperations);

      await delay(50); // Processor delay

      activeOperations--;
      return x * 2;
    });

    // Create concurrent processor with limit of 3
    const concurrencyLimit = 3;
    const concurrentProcess = map(processFn, concurrencyLimit);

    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const results: number[] = [];

    // Consume with a delay (creating backpressure)
    for await (const result of concurrentProcess(items)) {
      results.push(result);
      await delay(100); // Consumer delay (longer than processor delay)
    }

    // Verify the results
    expect(results.length).toBe(10);
    expect(processFn).toHaveBeenCalledTimes(10);

    // Most important check: concurrency limit was respected
    expect(maxActiveOperations).toBe(concurrencyLimit); // It should actually reach the limit
  });

  it.concurrent(
    'should process at least one value from an iterator that blocks indefinitely',
    async () => {
      // Create a deferred promise that will never resolve
      let neverResolve!: () => void;
      const blockingPromise = new Promise<void>(resolve => {
        neverResolve = resolve;
      });

      // Create an async generator that yields one value then blocks forever
      async function* createBlockingIterator() {
        yield 1; // This value should be processed
        await blockingPromise; // This will block forever
        yield 2; // This value should never be reached
      }

      // Process function that doubles the input with a small delay
      const processFn = vi.fn().mockImplementation(async (x: number) => {
        await delay(10);
        return x * 2;
      });

      // Use map with concurrency of 2
      const mapper = map(createBlockingIterator(), processFn, 2);

      // Try to get at least one result
      const results: number[] = [];
      let timedOut = false;

      // Set up a timeout to prevent the test from hanging
      const timeoutPromise = new Promise<void>(resolve => {
        setTimeout(() => {
          timedOut = true;
          resolve();
        }, 100);
      });

      // Race between getting values and timing out
      while (!timedOut) {
        const resultPromise = mapper.next();
        await Promise.race([resultPromise, timeoutPromise]);

        if (timedOut) break;

        const result = await resultPromise;
        if (result.done) break;

        results.push(result.value);
        if (results.length >= 1) break; // We only need to verify at least one result
      }

      // Verify we got at least one result
      expect(results.length).toBeGreaterThan(0);
      expect(results).toContain(2); // First value (1) doubled
      expect(processFn).toHaveBeenCalledWith(1, 0, createBlockingIterator());

      // Clean up to prevent test from hanging
      neverResolve();
    }
  );
});
