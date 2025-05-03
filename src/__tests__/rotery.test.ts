import { describe, expect, it } from 'vitest';
import { filter, find, map, mapWithConcurrency, pipe, take } from '../src/rotery';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('rotery re-exports', () => {
  it('should re-export map correctly', async () => {
    const numbers = [1, 2, 3, 4];
    const doubled = [];

    const mapper = async (x: number) => {
      await delay(10);
      return x * 2;
    };

    for await (const value of map(numbers, mapper)) {
      doubled.push(value);
    }

    expect(doubled).toEqual([2, 4, 6, 8]);
  });

  it('should re-export filter correctly', async () => {
    const numbers = [1, 2, 3, 4, 5, 6];
    const result = [];

    const isEven = async (x: number) => {
      await delay(10);
      return x % 2 === 0;
    };

    for await (const value of filter(numbers, isEven)) {
      result.push(value);
    }

    expect(result).toEqual([2, 4, 6]);
  });

  it('should re-export chunk correctly', async () => {
    const numbers = [1, 2, 3, 4, 5, 6, 7];
    const chunks = [];

    for await (const chunk of chunk(numbers, 3)) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });

  it('should re-export find correctly', async () => {
    const numbers = [1, 3, 5, 8, 10];

    const isEven = async (x: number) => {
      await delay(10);
      return x % 2 === 0;
    };

    const result = await find(numbers, isEven);

    expect(result).toBe(8);
  });

  it('should allow pipe composition', async () => {
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const results = [];

    const pipeline = pipe(
      numbers,
      filter(async x => x % 2 === 0),
      map(async x => x * 2),
      take(3)
    );

    for await (const value of pipeline) {
      results.push(value);
    }

    expect(results).toEqual([4, 8, 12]);
  });

  it('should support mapWithConcurrency', async () => {
    const numbers = [1, 2, 3, 4, 5];
    const processed = [];
    const processedOrder = [];

    // Create a mapper function with variable delays
    const slowMapper = async (num: number) => {
      // Items will complete in reverse order: 5 completes first, then 4, etc.
      const delayTime = (6 - num) * 20;
      await delay(delayTime);
      processedOrder.push(num); // Track the order items complete
      return num * 10;
    };

    // Process with concurrency of 5 (all at once)
    const pipeline = mapWithConcurrency(5, slowMapper)(numbers);

    for await (const value of pipeline) {
      processed.push(value);
    }

    // Final results should be in original order
    expect(processed).toEqual([10, 20, 30, 40, 50]);

    // But items should have been processed in reverse order
    expect(processedOrder).toEqual([5, 4, 3, 2, 1]);
  });
});
