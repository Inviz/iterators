import { describe, expect, it } from 'vitest';
import { race } from '..';

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

describe.concurrent('race', () => {
  it.concurrent(
    'should process multiple iterators concurrently with value-based delays',
    async () => {
      // Create generators where the value determines its own delay time
      // Lower numbers will complete faster, so the expected order is determined by the value
      const generator1 = createValueBasedDelayGenerator([150, 300, 450]);
      const generator2 = createValueBasedDelayGenerator([100, 250, 400]);
      const generator3 = createValueBasedDelayGenerator([50, 200, 350]);

      const raceFunction = race<number>(Infinity, Infinity);
      const iteratorsArray = [generator1, generator2, generator3];

      // Use the race function with our generators
      const results: number[] = [];

      for await (const result of raceFunction(iteratorsArray)) {
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
    const raceFunction = race<number>(bufferCapacity);

    const iteratorsArray = [promiseGen1, promiseGen2];
    const results: number[] = [];

    // This loop collects values as fast as possible
    for await (const value of raceFunction(iteratorsArray)) {
      results.push(value);
      if (results.length >= 8) break;
    }

    // With buffer capacity 2, we should get alternating values from the two streams
    expect(results).toEqual([11, 21, 12, 22, 13, 23, 14, 24]);
  });

  it.concurrent('3 streams with buffer capacity 2', async () => {
    // Create 3 streams with consistent delay but different values
    const stream1 = createPromiseGenerator([11, 12, 13], 50); // Stream 1: first digit 1, second digit order
    const stream2 = createPromiseGenerator([21, 22, 23, 24, 25], 50); // Stream 2: first digit 2, second digit order
    const stream3 = createPromiseGenerator([31, 32, 33, 34], 50); // Stream 3: first digit 3, second digit order

    // up to 3 streams, up to 2 values in flight
    const raceFunction = race<number>(3, 2);
    const results: number[] = [];

    // Collect all values
    for await (const value of raceFunction([stream1, stream2, stream3])) {
      results.push(value);
      console.log(value);
    }

    // Verify that all values from all streams are present
    // Third stream is not tapped until first is exhausted
    const expectedValues = [11, 21, 31, 12, 22, 32, 13, 23, 33, 24, 34, 25];
    expect(results).toEqual(expectedValues);
  });

  it.concurrent('2 streams with buffer capacity 3 - order validation', async () => {
    // Create 2 streams with consistent delay but different values
    const stream1 = createPromiseGenerator([11, 12, 13], 50); // Stream 1: first digit 1, second digit order
    const stream2 = createPromiseGenerator([21, 22, 23, 24, 25], 50); // Stream 2: first digit 2, second digit order
    const stream3 = createPromiseGenerator([31, 32, 33, 34], 50); // Stream 3: first digit 3, second digit order

    // Dont allow more than 2 streams to be processed at a time, but allow 3 values to be in flight
    const raceFunction = race<number>(2, 3);

    const results: number[] = [];

    // Collect all values
    for await (const value of raceFunction([stream1, stream2, stream3])) {
      results.push(value);
      if (results.length >= 10) break; // All 10 values from all streams
    }

    // With buffer capacity 3 and 2 streams, first values from both streams start,
    // then additional values from both streams start processing
    const expectedValues = [11, 21, 12, 22, 13, 23, 31, 24, 32, 25];
    expect(results).toEqual(expectedValues);
  });

  it.concurrent('should handle empty iterator list', async () => {
    const raceFunction = race<number>(2);
    const emptyArray: AsyncGenerator<number>[] = [];

    const results: number[] = [];
    for await (const result of raceFunction(emptyArray)) {
      results.push(result);
    }

    expect(results).toEqual([]);
  });
});
