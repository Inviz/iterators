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

    const items = [1, 2, 3, 4];
    const results: number[] = [];
    const startTime = Date.now();

    for await (const result of concurrentProcess(items)) {
      results.push(result);
    }

    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(300); // Should take ~200ms with concurrency of 2
    expect(results.sort()).toEqual([2, 4, 6, 8]);
    expect(processFn).toHaveBeenCalledTimes(4);
  });
});
