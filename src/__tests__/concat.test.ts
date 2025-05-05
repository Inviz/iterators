import { describe, expect, it, vitest } from 'vitest';
import { concat, map } from '..';

const trackConcurrency = (fn: (x: number) => Promise<number>) => {
  const processed: number[] = [];
  let inFlight = 0;
  let maxInFlight = 0;

  const trackedFn = vitest.fn(async (x: number) => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);

    const result = await fn(x);
    processed.push(result);
    inFlight--;
    return result;
  });

  Object.defineProperty(trackedFn, 'maxInFlight', {
    get: () => maxInFlight,
  });

  return trackedFn as typeof trackedFn & { maxInFlight: number };
};

// Helper to create a delay function
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to create an async generator that produces values with delays
async function* createDelayedGenerator(values: number[], delayMs: number): AsyncGenerator<number> {
  for (const value of values) {
    await delay(delayMs);
    yield value;
  }
}

// Helper that creates an async generator where the delay depends on the value itself
async function* createValueBasedDelayGenerator(values: number[]): AsyncGenerator<number> {
  const startTime = Date.now();
  for (const value of values) {
    // The delay is the value itself in milliseconds, adjusted for previous delays
    await delay(value - (Date.now() - startTime));
    yield value;
  }
}

// Helper that yields promises which resolve after a delay
async function* createPromiseGenerator(values: number[], delayMs: number): AsyncGenerator<number> {
  for (const value of values) {
    // Yield a promise that resolves after the specified delay
    yield new Promise<number>(resolve => {
      setTimeout(() => resolve(value), delayMs);
    });
  }
}

describe.concurrent('flatten', () => {
  it.concurrent(
    'should process multiple iterators concurrently with value-based delays',
    async () => {
      // Create generators where the value determines its own delay time
      // Lower numbers will complete faster, so the expected order is determined by the value
      const generator1 = createValueBasedDelayGenerator([150, 300, 450]);
      const generator2 = createValueBasedDelayGenerator([100, 250, 400]);
      const generator3 = createValueBasedDelayGenerator([50, 200, 350]);

      const flattenFunction = concat<number>(Infinity, Infinity);
      const iteratorsArray = [generator1, generator2, generator3];

      // Use the flatten function with our generators
      const results: number[] = [];

      for await (const result of flattenFunction(iteratorsArray)) {
        results.push(result);
      }

      // Values should appear in ascending order since lower values have shorter delays
      expect(results).toEqual([50, 100, 150, 200, 250, 300, 350, 400, 450]);
    }
  );

  it.concurrent('should respect buffer capacity when processing promises', async () => {
    // Create promise generators that resolve after a delay
    // Each generator yields promises that resolve after 50ms
    const promiseGen1 = createPromiseGenerator([11, 12, 13, 14], 50);
    const promiseGen2 = createPromiseGenerator([21, 22, 23, 24], 50);

    // Set a small buffer capacity - limiting how many outstanding promises can be processed
    const bufferCapacity = 2;
    const flattenFunction = concat<number>(bufferCapacity);

    const iteratorsArray = [promiseGen1, promiseGen2];
    const results: number[] = [];

    // This loop collects values as fast as possible
    for await (const value of flattenFunction(iteratorsArray)) {
      results.push(value);
      if (results.length >= 8) break;
    }

    // With buffer capacity 2, we should get alternating values from the two streams
    expect(results).toEqual([11, 21, 12, 22, 13, 23, 14, 24]);
  });

  describe.concurrent('Order', () => {
    it.concurrent('should tap iterators eagerly', async () => {
      // Create 3 streams with consistent delay but different values
      const stream1 = createPromiseGenerator([11, 12, 13], 50); // Stream 1: first digit 1, second digit order
      const stream2 = createPromiseGenerator([21, 22, 23, 24, 25], 50); // Stream 2: first digit 2, second digit order
      const stream3 = createPromiseGenerator([31, 32, 33, 34], 50); // Stream 3: first digit 3, second digit order

      // all 3 are allowed to tap
      const flattenFunction = concat<number>(3, Infinity);
      const results: number[] = [];

      // Collect all values
      for await (const value of flattenFunction([stream1, stream2, stream3])) {
        results.push(value);
      }

      // Verify that all values from all streams are present
      // Third stream is not tapped until first is exhausted
      const expectedValues = [11, 21, 31, 12, 22, 32, 13, 23, 33, 24, 34, 25];
      expect(results).toEqual(expectedValues);
    });

    it.concurrent(
      'should tap next iterator over concurrency limit, once previous iterator is exhausted',
      async () => {
        // Create 2 streams with consistent delay but different values
        const stream1 = createPromiseGenerator([11, 12, 13], 50); // Stream 1: first digit 1, second digit order
        const stream2 = createPromiseGenerator([21, 22, 23, 24, 25], 50); // Stream 2: first digit 2, second digit order
        const stream3 = createPromiseGenerator([31, 32, 33, 34], 50); // Stream 3: first digit 3, second digit order

        // Dont allow more than 2 streams to be processed at a time, but allow 3 values to be in flight
        const flattenFunction = concat<number>(2, 3);

        const results: number[] = [];

        // Collect all values
        for await (const value of flattenFunction([stream1, stream2, stream3])) {
          results.push(value);
          if (results.length >= 10) break; // All 10 values from all streams
        }

        // With buffer capacity 3 and 2 streams, first values from both streams start,
        // then additional values from both streams start processing
        const expectedValues = [11, 21, 12, 22, 13, 23, 31, 24, 32, 25];
        expect(results).toEqual(expectedValues);
      }
    );
  });

  describe.concurrent('Input types', () => {
    it.concurrent('should handle empty iterator list', async () => {
      const flattenFunction = concat<number>(2);
      const emptyArray: AsyncGenerator<number>[] = [];

      const results: number[] = [];
      for await (const result of flattenFunction(emptyArray)) {
        results.push(result);
      }

      expect(results).toEqual([]);
    });

    it.concurrent('should work with concurrent iterators as input', async () => {
      // Create a shared start time for all operations
      const testStartTime = Date.now();

      // Processing functions with time-based delays relative to the start time
      const processFn1 = async (x: number) => {
        const elapsedTime = Date.now() - testStartTime;
        const targetTime = x * 50; // Target time in ms (x indicates desired position * 50ms)
        const remainingDelay = Math.max(0, targetTime - elapsedTime);

        await delay(remainingDelay);
        return 1000 + x; // 1000-series indicates stream 1
      };

      const processFn2 = async (x: number) => {
        const elapsedTime = Date.now() - testStartTime;
        const targetTime = x * 50; // Target time in ms (x indicates desired position * 50ms)
        const remainingDelay = Math.max(0, targetTime - elapsedTime);

        await delay(remainingDelay);
        return 2000 + x; // 2000-series indicates stream 2
      };

      const processFn3 = async (x: number) => {
        const elapsedTime = Date.now() - testStartTime;
        const targetTime = x * 50; // Target time in ms (x indicates desired position * 50ms)
        const remainingDelay = Math.max(0, targetTime - elapsedTime);

        await delay(remainingDelay);
        return 3000 + x; // 3000-series indicates stream 3
      };

      // Create concurrent iterators
      const concurrentStream1 = map(processFn1, 1);
      const concurrentStream2 = map(processFn2, 1);
      const concurrentStream3 = map(processFn3, 1);

      // Input values directly indicate the desired position in the final output
      // Example: 1 should be the 1st item, 2 should be the 2nd item, etc.
      const input1 = [1, 4, 7]; // Stream 1 values should appear at positions 1, 4, 7
      const input2 = [2, 5, 8]; // Stream 2 values should appear at positions 2, 5, 8
      const input3 = [3, 6, 9]; // Stream 3 values should appear at positions 3, 6, 9@

      // Apply concurrent processing to each input stream
      const stream1 = concurrentStream1(input1);
      const stream2 = concurrentStream2(input2);
      const stream3 = concurrentStream3(input3);

      // Race the concurrent streams
      const flattenFunction = concat<number>(3, 3); // Allow all 3 streams, 3 values in flight

      const results: number[] = [];

      // Collect all values from the flatten
      for await (const result of flattenFunction([stream1, stream2, stream3])) {
        results.push(result);
      }

      // With our setup, each input value controls when its result will be ready
      // x=1 is ready at ~50ms, x=2 at ~100ms, etc., so the values should come out in order

      // Verify the exact order of results - should match the input values' intended order
      const expectedOrder = [
        1001, // Stream1: position 1 (1 + 1000)
        2002, // Stream2: position 2 (2 + 2000)
        3003, // Stream3: position 3 (3 + 3000)
        1004, // Stream1: position 4 (4 + 1000)
        2005, // Stream2: position 5 (5 + 2000)
        3006, // Stream3: position 6 (6 + 3000)
        1007, // Stream1: position 7 (7 + 1000)
        2008, // Stream2: position 8 (8 + 2000)
        3009, // Stream3: position 9 (9 + 3000)
      ];

      expect(results).toEqual(expectedOrder);
    });
  });

  describe.concurrent('Lazy consumption', () => {
    function getGenerators(max: number) {
      // Track when values are consumed from source generators
      const consumed1: number[] = [];
      const consumed2: number[] = [];
      const consumed3: number[] = [];

      // Create generators that track when values are pulled from them
      async function* trackedGenerator1(): AsyncGenerator<number> {
        for (let i = 1; i <= max; i++) {
          const value = i * 10;
          consumed1.push(value);
          yield value;
        }
      }

      async function* trackedGenerator2(): AsyncGenerator<number> {
        for (let i = 1; i <= max; i++) {
          const value = i * 100;
          consumed2.push(value);
          yield value;
        }
      }

      async function* trackedGenerator3(): AsyncGenerator<number> {
        for (let i = 1; i <= max; i++) {
          const value = i * 1000;
          consumed3.push(value);
          yield value;
        }
      }

      return {
        consumed1,
        consumed2,
        consumed3,
        trackedGenerator1,
        trackedGenerator2,
        trackedGenerator3,
      };
    }
    it.concurrent('should be able to consume a single stream at a time', async () => {
      const {
        consumed1,
        consumed2,
        consumed3,
        trackedGenerator1,
        trackedGenerator2,
        trackedGenerator3,
      } = getGenerators(3);
      const flattenFunction = concat<number>(
        1,
        Infinity /* eagerInput: 1, eagerOutput: Infinity */
      );
      const flattenIterator = flattenFunction([
        trackedGenerator1(),
        trackedGenerator2(),
        trackedGenerator3(),
      ]);
      expect(consumed2).toEqual([]);
      expect(consumed1).toEqual([]);

      // Consume first 2 values (should fill the buffer)
      expect(await flattenIterator.next().then(r => r.value)).toEqual(10);
      expect(consumed1).toEqual([10, 20, 30]);
      expect(consumed2).toEqual([]);
      expect(consumed3).toEqual([]);
      expect(await flattenIterator.next().then(r => r.value)).toEqual(20);
      expect(consumed1).toEqual([10, 20, 30]);
      expect(consumed2).toEqual([]);
      expect(consumed3).toEqual([]);
      expect(await flattenIterator.next().then(r => r.value)).toEqual(30);
      await new Promise(setImmediate); // allow iterator to catch up
      expect(consumed1).toEqual([10, 20, 30]);
      expect(consumed2).toEqual([100, 200, 300]);
      expect(consumed3).toEqual([]);
      expect(await flattenIterator.next().then(r => r.value)).toEqual(100);
      expect(consumed1).toEqual([10, 20, 30]);
      expect(consumed2).toEqual([100, 200, 300]);
      expect(consumed3).toEqual([]);
      expect(await flattenIterator.next().then(r => r.value)).toEqual(200);
      expect(consumed1).toEqual([10, 20, 30]);
      expect(consumed2).toEqual([100, 200, 300]);
      expect(consumed3).toEqual([]);
      expect(await flattenIterator.next().then(r => r.value)).toEqual(300);
      await new Promise(setImmediate); // allow iterator to catch up
      expect(consumed1).toEqual([10, 20, 30]);
      expect(consumed2).toEqual([100, 200, 300]);
      expect(consumed3).toEqual([1000, 2000, 3000]);
    });
    it.concurrent('should be able to consume streams concurrently', async () => {
      const {
        consumed1,
        consumed2,
        consumed3,
        trackedGenerator1,
        trackedGenerator2,
        trackedGenerator3,
      } = getGenerators(3);
      // Set up flatten with buffer capacity of 2
      const flattenFunction = concat<number>(2, Infinity);
      const flattenIterator = flattenFunction([
        trackedGenerator1(),
        trackedGenerator2(),
        trackedGenerator3(),
      ]);
      expect(consumed2).toEqual([]);
      expect(consumed1).toEqual([]);
      expect(consumed3).toEqual([]);

      // Consume first 2 iterators
      expect(await flattenIterator.next().then(r => r.value)).toEqual(10);
      expect(consumed1).toEqual([10, 20, 30]);
      expect(consumed2).toEqual([100, 200, 300]);
      expect(consumed3).toEqual([]);
      expect(await flattenIterator.next().then(r => r.value)).toEqual(100);
      expect(consumed1).toEqual([10, 20, 30]);
      expect(consumed2).toEqual([100, 200, 300]);
      expect(consumed3).toEqual([]);
      expect(await flattenIterator.next().then(r => r.value)).toEqual(20);
      expect(consumed1).toEqual([10, 20, 30]);
      expect(consumed2).toEqual([100, 200, 300]);
      expect(consumed3).toEqual([]);
      expect(await flattenIterator.next().then(r => r.value)).toEqual(200);
      expect(consumed1).toEqual([10, 20, 30]);
      expect(consumed2).toEqual([100, 200, 300]);
      expect(consumed3).toEqual([]);
      expect(await flattenIterator.next().then(r => r.value)).toEqual(30);
      await new Promise(setImmediate); // allow event loop to catch up to fetch more values
      expect(consumed1).toEqual([10, 20, 30]);
      expect(consumed2).toEqual([100, 200, 300]);
      expect(consumed3).toEqual([1000, 2000, 3000]);
      expect(await flattenIterator.next().then(r => r.value)).toEqual(300);
      expect(await flattenIterator.next().then(r => r.value)).toEqual(1000);
      expect(await flattenIterator.next().then(r => r.value)).toEqual(2000);
      expect(await flattenIterator.next().then(r => r.value)).toEqual(3000);
    });
  });
  async function fromAsync<T>(iterable: AsyncIterable<T>): Promise<T[]> {
    const results: T[] = [];
    for await (const result of iterable) {
      results.push(result);
    }
    return results;
  }
  describe.concurrent('Concurrency control', () => {
    describe.concurrent('One upstream', () => {
      it.concurrent('should be able to produce a single stream at a time', async () => {
        const processFn = trackConcurrency(async v => {
          await delay(10);
          return v * 10;
        });
        // Create a concurrent processor with concurrency of 2
        const upstream = map(processFn, 1)([1, 2, 3, 4, 5, 6]);
        const results = await fromAsync(concat<number>(Infinity, 1)([upstream]));
        // With output concurrency of 1, maxInFlight should never exceed 1
        expect(results).toEqual([10, 20, 30, 40, 50, 60]);
        expect(processFn.maxInFlight).toBe(1);
      });
      it.concurrent(
        'should be able to produce two items concurrently, even if downstream concurrency is 1',
        async () => {
          const upstreamFn = trackConcurrency(async v => {
            await delay(10);
            return v * 10;
          });
          const downstremFn = trackConcurrency(async v => {
            await delay(10);
            return -v;
          });
          // Create a concurrent processor with concurrency of 2
          const upstream = map(upstreamFn, 2)([1, 2, 3, 4, 5, 6]);
          const mixed = concat<number>(Infinity, 1)([upstream]);
          const downstream = map(downstremFn, 1)(mixed);
          // With output concurrency of 1, maxInFlight should never exceed 1
          expect(await fromAsync(downstream)).toEqual([-10, -20, -30, -40, -50, -60]);
          expect(upstreamFn.maxInFlight).toBe(2);
          expect(downstremFn.maxInFlight).toBe(1);
        }
      );
      it.concurrent(
        'should be able to produce and consume two items concurrently with equal timing',
        async () => {
          const upsteamFn = trackConcurrency(async v => {
            await delay(10);
            return v * 10;
          });
          const downstreamFn = trackConcurrency(async v => {
            await delay(10);
            return -v;
          });
          // Create a concurrent processor with concurrency of 2
          const upstream = map(upsteamFn, 2)([1, 2, 3, 4, 5, 6]);
          const mixed = concat<number>(Infinity, 1)([upstream]);
          const downstream = map(downstreamFn, 2)(mixed);
          // With output concurrency of 1, maxInFlight should never exceed 1
          expect(await fromAsync(downstream)).toEqual([-10, -20, -30, -40, -50, -60]);
          expect(upsteamFn.maxInFlight).toBe(2);
          expect(downstreamFn.maxInFlight).toBe(2);
        }
      );
      it.concurrent(
        'should be able to produce and consume two items concurrently with slow upstream',
        async () => {
          const upsteamFn = trackConcurrency(async v => {
            await delay(20);
            return v * 10;
          });
          const downstreamFn = trackConcurrency(async v => {
            await delay(10);
            return -v;
          });
          // Create a concurrent processor with concurrency of 2
          const upstream = map(upsteamFn, 2)([1, 2, 3, 4, 5, 6]);
          const mixed = concat<number>(Infinity, 1)([upstream]);
          const downstream = map(downstreamFn, 2)(mixed);
          // With output concurrency of 1, maxInFlight should never exceed 1
          expect(await fromAsync(downstream)).toEqual([-10, -20, -30, -40, -50, -60]);
          expect(upsteamFn.maxInFlight).toBe(2);
          expect(downstreamFn.maxInFlight).toBe(2);
        }
      );
      it.concurrent(
        'should be able to produce and consume two items concurrently with slow downstream',
        async () => {
          const upsteamFn = trackConcurrency(async v => {
            await delay(10);
            return v * 10;
          });
          const downstreamFn = trackConcurrency(async v => {
            await delay(20);
            return -v;
          });
          // Create a concurrent processor with concurrency of 2
          const upstream = map(upsteamFn, 2)([1, 2, 3, 4, 5, 6]);
          const mixed = concat<number>(Infinity, 1)([upstream]);
          const downstream = map(downstreamFn, 2)(mixed);
          // With output concurrency of 1, maxInFlight should never exceed 1
          expect(await fromAsync(downstream)).toEqual([-10, -20, -30, -40, -50, -60]);
          expect(upsteamFn.maxInFlight).toBe(2);
          expect(downstreamFn.maxInFlight).toBe(2);
        }
      );
    });
    describe.concurrent('Two upstreams', () => {
      it.concurrent('should respect each individual upstream concurrency control', async () => {
        const upsteamFn1 = trackConcurrency(async v => {
          await delay(10);
          return v * 10;
        });
        const upsteamFn2 = trackConcurrency(async v => {
          await delay(10);
          return v * -10;
        });
        // Create a concurrent processor with concurrency of 2
        const upstream1 = map(upsteamFn1, 1)([1, 2, 3, 4, 5, 6]);
        const upstream2 = map(upsteamFn2, 1)([10, 20, 30, 40, 50, 60]);
        const results = await fromAsync(concat<number>(Infinity, Infinity)([upstream1, upstream2]));
        // With output concurrency of 1, maxInFlight should never exceed 1
        expect(results).toEqual([10, -100, 20, -200, 30, -300, 40, -400, 50, -500, 60, -600]);
        expect(upsteamFn1.maxInFlight).toBe(1);
        expect(upsteamFn2.maxInFlight).toBe(1);
      });

      it.concurrent('should be able to flatten streams of different speeds', async () => {
        const upsteamFn1 = trackConcurrency(async v => {
          return v * 10;
        });
        const upsteamFn2 = trackConcurrency(async v => {
          await delay(20);
          return v * -10;
        });
        // Create a concurrent processor with concurrency of 2
        const upstream1 = map(upsteamFn1, 1)([1, 2, 3, 4, 5, 6]);
        const upstream2 = map(upsteamFn2, 1)([10, 20, 30, 40, 50, 60]);
        const results = await fromAsync(concat<number>(Infinity, Infinity)([upstream1, upstream2]));
        expect(results).toEqual([10, 20, 30, 40, 50, 60, -100, -200, -300, -400, -500, -600]);
        expect(upsteamFn1.maxInFlight).toBe(1);
        expect(upsteamFn2.maxInFlight).toBe(1);
      });

      it.concurrent('should be able to flatten two concurrent streams speeds', async () => {
        const upsteamFn1 = trackConcurrency(async v => {
          await delay(10);
          return v * 10;
        });
        const upsteamFn2 = trackConcurrency(async v => {
          await delay(10);
          return v * -10;
        });
        // Create a concurrent processor with concurrency of 2
        const upstream1 = map(upsteamFn1, 2)([1, 2, 3, 4, 5, 6]);
        const upstream2 = map(upsteamFn2, 2)([10, 20, 30, 40, 50, 60]);
        const results = await fromAsync(concat<number>(Infinity, Infinity)([upstream1, upstream2]));
        expect(results).toEqual([10, 20, -100, -200, 30, 40, -300, -400, 50, 60, -500, -600]);
        expect(upsteamFn1.maxInFlight).toBe(2);
        expect(upsteamFn2.maxInFlight).toBe(2);
      });
    });
    describe.concurrent('Three upstreams', () => {
      it.concurrent('should tap into next stream when previous stream is done', async () => {
        const upsteamFn1 = trackConcurrency(async v => {
          await delay(10);
          return v * 10;
        });
        const upsteamFn2 = trackConcurrency(async v => {
          await delay(10);
          return v * -10;
        });
        const upsteamFn3 = trackConcurrency(async v => {
          await delay(10);
          return v + 7;
        });
        const upstream1 = map(upsteamFn1, 1)([1, 2, 3, 4, 5, 6, 7]);
        const upstream2 = map(upsteamFn2, 1)([10, 20, 30]);
        const upstream3 = map(upsteamFn3, 1)([100, 200, 300]);
        const results = await fromAsync(
          concat<number>(2, Infinity)([upstream1, upstream2, upstream3])
        );
        expect(results).toEqual([10, -100, 20, -200, 30, -300, 40, 107, 50, 207, 60, 307, 70]);
        expect(upsteamFn1.maxInFlight).toBe(1);
        expect(upsteamFn2.maxInFlight).toBe(1);
        expect(upsteamFn3.maxInFlight).toBe(1);
      });
      it.concurrent('should tap into next concurrent when previous stream is done', async () => {
        const upsteamFn1 = trackConcurrency(async v => {
          await delay(10);
          return v * 10;
        });
        const upsteamFn2 = trackConcurrency(async v => {
          await delay(10);
          return v * -10;
        });
        const upsteamFn3 = trackConcurrency(async v => {
          await delay(10);
          return v + 7;
        });
        const upstream1 = map(upsteamFn1, 2)([1, 2, 3, 4, 5, 6, 7]);
        const upstream2 = map(upsteamFn2, 2)([10, 20, 30]);
        const upstream3 = map(upsteamFn3, 2)([100, 200, 300]);
        const results = await fromAsync(
          concat<number>(2, Infinity)([upstream1, upstream2, upstream3])
        );
        expect(results).toEqual([10, 20, -100, -200, 30, 40, -300, 50, 60, 107, 207, 70, 307]);
        expect(upsteamFn1.maxInFlight).toBe(2);
        expect(upsteamFn2.maxInFlight).toBe(2);
        expect(upsteamFn3.maxInFlight).toBe(2);
      });
    });
  });
});
