import { describe, expect, it, vi } from 'vitest';
import { concurrent } from '..';

// Helper to create a delay function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe.concurrent('concurrent', () => {
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
    for await (const result of concurrent(2, processFn, items)) {
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

    const concurrentProcess = concurrent(3, processFn);

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

    const concurrentProcess = concurrent(2, processFn);

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
    expect(processFn).toHaveBeenCalledTimes(5); // 4 real and  1 eagerly produced result
  });

  it.concurrent('should support composing concurrent operations', async () => {
    // First processor doubles numbers with concurrency of 2
    console.time('step1');
    console.time('step2');
    const processFn1 = vi.fn().mockImplementation(async (x: number) => {
      console.timeLog('step1', x);
      await delay(100);
      return x * 2;
    });

    // Second processor adds 10 to numbers with concurrency of 3
    const processFn2 = vi.fn().mockImplementation(async (x: number) => {
      console.timeLog('step2', x);
      await delay(100);
      return x + 10;
    });

    const firstConcurrent = concurrent(2, processFn1);
    const secondConcurrent = concurrent(3, processFn2);
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
    expect(processFn1).toHaveBeenCalledTimes(8); // Step 2 requested for 2 more items, and then step 1 also eagerly produced 1 more
    expect(calledTimes).toBe(7); // input generator produced 7  values

    const duration = Date.now() - startTime;

    // With proper concurrency, this should complete in around 300ms
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
    const concurrentProcess = concurrent(concurrencyLimit, processFn);

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
});
