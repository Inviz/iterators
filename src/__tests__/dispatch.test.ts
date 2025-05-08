import { describe, expect, it, vitest } from 'vitest';
import { accumulate, chunk, dispatch, filter, map, pipe } from '..';
import { trackConcurrency } from './concat.test';

describe.concurrent('dispatch', () => {
  it.concurrent('sends value to a single stream and waits for completion', async () => {
    // Track processed items and their order
    const processedItems: number[] = [];
    const processOrder: string[] = [];

    // Create a processor that adds some delay
    const slowProcessor = map(async (x: number) => {
      processOrder.push(`start-process-${x}`);
      // Add delay to simulate async work
      await new Promise(resolve => setTimeout(resolve, 50));
      processedItems.push(x);
      processOrder.push(`end-process-${x}`);
      return x * 2;
    });

    // Create a splitter that routes all items to the first stream

    // Create the test pipeline
    const result = pipe(
      [1, 2, 3, 4, 5],
      dispatch(x => [x] as const, slowProcessor)
    );

    // Collect results
    const collected = await accumulate(result);

    // Verify all items were processed
    expect(processedItems).toEqual([1, 2, 3, 4, 5]);
    expect(collected).toEqual([1, 2, 3, 4, 5]);

    // Check that processing order shows waiting behavior
    // The pattern should be start-1, end-1, start-2, end-2, etc.,
    // proving the function waits for each item to be processed
    for (let i = 1; i <= 5; i++) {
      const startIdx = processOrder.findIndex(item => item === `start-process-${i}`);
      const endIdx = processOrder.findIndex(item => item === `end-process-${i}`);

      // Verify that each start is followed by its end before the next start
      expect(startIdx).toBeLessThan(endIdx);

      // If not the last item, verify that this item's processing ends before next starts
      if (i < 5) {
        const nextStartIdx = processOrder.findIndex(item => item === `start-process-${i + 1}`);
        expect(endIdx).toBeLessThan(nextStartIdx);
      }
    }
  });

  it.concurrent('sends values to multiple streams in parallel', async () => {
    const streamAItems: number[] = [];
    const streamBItems: number[] = [];
    const processEvents: string[] = [];

    // Stream A - process odd numbers
    const streamA = map(async (x: number) => {
      processEvents.push(`A-start-${x}`);
      await new Promise(resolve => setTimeout(resolve, 50));
      streamAItems.push(x);
      processEvents.push(`A-end-${x}`);
      return x * 2;
    });

    // Stream B - process even numbers
    const streamB = map(async (x: number) => {
      processEvents.push(`B-start-${x}`);
      await new Promise(resolve => setTimeout(resolve, 30));
      streamBItems.push(x);
      processEvents.push(`B-end-${x}`);
      return x * 3;
    });

    // Split odd numbers to stream A, even numbers to stream B
    const splitter = (x: number) =>
      x % 2 === 1 ? ([x, undefined] as const) : ([undefined, x] as const);

    // Process inputs
    const result = pipe(
      [1, 2, 3, 4, 5, 6],
      dispatch(splitter, streamA, streamB, undefined, undefined, 2)
    );

    const collected = await accumulate(result);

    // Verify items went to correct streams
    expect(streamAItems).toEqual([1, 3, 5]);
    expect(streamBItems).toEqual([2, 4, 6]);
    expect(collected).toEqual([1, 2, 3, 4, 5, 6]);
    expect(processEvents).toEqual([
      'A-start-1',
      'B-start-2',
      'B-end-2',
      'B-start-4',
      'A-end-1',
      'A-start-3',
      'B-end-4',
      'B-start-6',
      'B-end-6',
      'A-end-3',
      'A-start-5',
      'A-end-5',
    ]);
  });

  it.concurrent('original input is returned in order regardless of processing time', async () => {
    // Create streams with varying processing times
    const streamA = map(async (x: number) => {
      // Stream A takes longer for larger numbers
      await new Promise(resolve => setTimeout(resolve, x * 20));
      return x * 2;
    });

    const streamB = map(async (x: number) => {
      // Stream B takes longer for smaller numbers
      await new Promise(resolve => setTimeout(resolve, (10 - x) * 15));
      return x * 3;
    });

    // Send all values to both streams
    const splitter = (x: number) => [x, x] as const;

    // Process inputs - should maintain original order despite different processing times
    const result = pipe([1, 2, 3, 4, 5], dispatch(splitter, streamA, streamB));

    const collected = await accumulate(result);

    // Original order should be preserved
    expect(collected).toEqual([1, 2, 3, 4, 5]);
  });

  it.concurrent('handles tuples similar to parse-hands.ts usage', async () => {
    // Simulate game and table objects
    type Game = { id: string; data: string };
    type Table = { gameId: string; stats: number[] };

    const inputData: [Game, Table][] = [
      [
        { id: 'game1', data: 'data1' },
        { gameId: 'game1', stats: [10, 20] },
      ],
      [
        { id: 'game2', data: 'data2' },
        { gameId: 'game2', stats: [30, 40] },
      ],
      [
        { id: 'game3', data: 'data3' },
        { gameId: 'game3', stats: [50, 60] },
      ],
    ];

    const processedGames: Game[] = [];
    const processedTables: Table[] = [];

    // Process games
    const gameProcessor = pipe(
      filter((game: Game) => true),
      chunk(2),
      map(async (games: Game[]) => {
        // Simulate some async processing
        await new Promise(resolve => setTimeout(resolve, 20));
        games.forEach(game => processedGames.push(game));
        return games;
      })
    );

    // Process tables
    const tableProcessor = pipe(
      filter((table: Table) => true),
      chunk(2),
      map(async (tables: Table[]) => {
        // Simulate some async processing
        await new Promise(resolve => setTimeout(resolve, 30));
        tables.forEach(table => processedTables.push(table));
        return tables;
      })
    );

    // Split input into game and table
    const splitter = ([game, table]: [Game, Table]) => [game, table] as const;

    // Create pipeline similar to parse-hands.ts
    const result = pipe(inputData, dispatch(splitter, gameProcessor, tableProcessor));

    // Process all data
    const output = await accumulate(result);

    // Verify all items were processed correctly
    expect(output).toEqual(inputData);
    expect(processedGames).toEqual(inputData.map(([game]) => game));
    expect(processedTables).toEqual(inputData.map(([, table]) => table));
  });

  it.concurrent('handles conditional routing based on data', async () => {
    // Create test data
    const inputData = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    const streamAResults: number[] = [];
    const streamBResults: number[] = [];
    const streamCResults: number[] = [];

    // Stream A processes numbers divisible by 2
    const streamA = map(async (x: number) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      streamAResults.push(x);
      return x * 2;
    });

    // Stream B processes numbers divisible by 3
    const streamB = map(async (x: number) => {
      await new Promise(resolve => setTimeout(resolve, 15));
      streamBResults.push(x);
      return x * 3;
    });

    // Stream C processes numbers divisible by 5
    const streamC = map(async (x: number) => {
      await new Promise(resolve => setTimeout(resolve, 20));
      streamCResults.push(x);
      return x * 5;
    });

    // Conditional splitter based on divisibility
    const splitter = (x: number) => {
      const result: [number?, number?, number?] = [];

      if (x % 2 === 0) result[0] = x;
      if (x % 3 === 0) result[1] = x;
      if (x % 5 === 0) result[2] = x;

      return result;
    };

    // Create the pipeline
    const result = pipe(inputData, dispatch(splitter, streamA, streamB, streamC));

    // Process all data
    const output = await accumulate(result);

    // Verify outputs
    expect(output).toEqual(inputData);
    expect(streamAResults).toEqual([2, 4, 6, 8, 10]);
    expect(streamBResults).toEqual([3, 6, 9]);
    expect(streamCResults).toEqual([5, 10]);
  });

  it.concurrent('handles concurrency with many items', async () => {
    const inputSize = 50;
    const inputData = Array.from({ length: inputSize }, (_, i) => i + 1);
    const concurrencyLimit = 10;

    // Create a tracked processor with random delays
    const trackedProcessor = trackConcurrency(async (x: number) => {
      // Random processing time between 10-30ms
      const delay = 10 + Math.floor(Math.random() * 20);
      await new Promise(resolve => setTimeout(resolve, delay));
      return x;
    });

    // Create the pipeline with splitter that sends all items to one stream
    const result = pipe(
      inputData,
      dispatch(
        (x: number) => [x] as const,
        map(trackedProcessor, concurrencyLimit),
        undefined,
        undefined,
        undefined,
        concurrencyLimit
      )
    );

    // Process all data
    const output = await accumulate(result);

    // Verify all items were processed
    expect(output).toEqual(inputData);

    // Verify concurrency was respected
    expect(trackedProcessor.maxInFlight).toBe(concurrencyLimit);
  });

  it.concurrent('uncurried version works correctly', async () => {
    const processedItems: number[] = [];

    // Create a processor
    const processor = map(async (x: number) => {
      await new Promise(resolve => setTimeout(resolve, 10));
      processedItems.push(x);
      return x * 2;
    });

    // Create a curried dispatch function
    const result = dispatch([1, 2, 3, 4, 5], (x: number) => [x] as const, processor);

    // Process all data
    const output = await accumulate(result);

    // Verify all items were processed
    expect(output).toEqual([1, 2, 3, 4, 5]);
    expect(processedItems).toEqual([1, 2, 3, 4, 5]);
  });

  it.concurrent('handles empty inputs', async () => {
    const processedItems: number[] = [];

    // Create a processor
    const processor = map((x: number) => {
      processedItems.push(x);
      return x * 2;
    });

    // Process empty array
    const result = pipe(
      [],
      dispatch((x: number) => [x] as const, processor)
    );

    // Process all data
    const output = await accumulate(result);

    // Verify empty array was handled correctly
    expect(output).toEqual([]);
    expect(processedItems).toEqual([]);
  });

  it.concurrent('handles error in splitter function', async () => {
    // Create a processor
    const processor = map((x: number) => x * 2);

    // Create a splitter that throws an error for a specific value
    const splitter = (x: number) => {
      if (x === 3) {
        throw new Error('Test error');
      }
      return [x] as const;
    };

    // Create pipeline
    const result = pipe([1, 2, 3, 4, 5], dispatch(splitter, processor));

    // The error should propagate
    await expect(accumulate(result)).rejects.toThrow('Test error');
  });

  it.concurrent('handles error in processor function', async () => {
    // Create a processor that throws an error
    const processor = map((x: number) => {
      if (x === 3) {
        throw new Error('Processor error');
      }
      return x * 2;
    });

    // Create pipeline
    const result = pipe(
      [1, 2, 3, 4, 5],
      dispatch((x: number) => [x] as const, processor)
    );

    // The error should propagate
    await expect(accumulate(result)).rejects.toThrow('Processor error');
  });

  it.concurrent('handles nullish values in splitter results', async () => {
    const streamAItems: number[] = [];
    const streamBItems: number[] = [];

    // Stream processors
    const streamA = map((x: number) => {
      streamAItems.push(x);
      return x * 2;
    });

    const streamB = map((x: number) => {
      streamBItems.push(x);
      return x * 3;
    });

    // Splitter that returns nullish values
    const splitter = (x: number): [number?, number?] => {
      // Alternate between sending to A, B, or neither
      if (x % 3 === 0) return [undefined, x]; // Send to B only
      if (x % 3 === 1) return [x, undefined]; // Send to A only
      return [undefined, undefined]; // Send to neither
    };

    // Create pipeline
    const result = pipe([1, 2, 3, 4, 5, 6], dispatch(splitter, streamA, streamB));

    // Process all data
    const output = await accumulate(result);

    // Verify routing
    expect(output).toEqual([1, 2, 3, 4, 5, 6]);
    expect(streamAItems).toEqual([1, 4]);
    expect(streamBItems).toEqual([3, 6]);
  });

  it.concurrent('backpressure is respected with slow downstream consumers', async () => {
    const processedItems: number[] = [];
    const processOrder: string[] = [];

    // Create a fast processor
    const fastProcessor = pipe(
      map(async (x: number) => {
        processOrder.push(`processor-start-${x}`);
        // Fast processing
        await new Promise(resolve => setTimeout(resolve, 5));
        processedItems.push(x);
        processOrder.push(`processor-end-${x}`);
        return x;
      })
    );

    // Create a slow downstream consumer
    const slowIterator = async function* (iterable: AsyncIterable<number>) {
      for await (const item of iterable) {
        processOrder.push(`consumer-start-${item}`);
        // Slow consumption
        await new Promise(resolve => setTimeout(resolve, 50));
        processOrder.push(`consumer-end-${item}`);
        yield item;
      }
    };

    // Create the pipeline with dispatch and slow consumer
    const result = pipe(
      [1, 2, 3],
      dispatch(x => [x] as const, fastProcessor),
      slowIterator
    );

    // Process all data
    const output = await accumulate(result);

    // Verify all items were processed
    expect(output).toEqual([1, 2, 3]);
    expect(processedItems).toEqual([1, 2, 3]);

    // Verify backpressure was applied
    // For each item, consumer-end should come before next processor-start
    for (let i = 1; i < 3; i++) {
      const consumerEndIdx = processOrder.findIndex(item => item === `consumer-end-${i}`);
      const nextProcessorStartIdx = processOrder.findIndex(
        item => item === `processor-start-${i + 1}`
      );

      // Verify consumer finished before next item is processed
      expect(consumerEndIdx).toBeLessThan(nextProcessorStartIdx);
    }
  });
});

describe.concurrent('Concurrency control', () => {
  // Import the trackConcurrency helper
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

  it.concurrent('respects concurrency in async splitter function', async () => {
    const inputSize = 30;
    const inputData = Array.from({ length: inputSize }, (_, i) => i + 1);
    const concurrencyLimit = 5;

    // Create a tracked async splitter function
    const trackedSplitter = trackConcurrency(async (x: number) => {
      // Add delay to make the async nature clear
      await delay(20);
      return x;
    });

    // The actual splitter function that uses the tracked function
    const splitter = async (x: number) => {
      const result = await trackedSplitter(x);
      return [result] as const;
    };

    // Simple processor
    const processor = map((x: number) => x * 2);

    // Create the pipeline with limited concurrency
    const result = pipe(
      inputData,
      dispatch(splitter, processor, undefined, undefined, undefined, concurrencyLimit)
    );

    // Process all data
    const output = await accumulate(result);

    // Verify all items were processed
    expect(output).toEqual(inputData);

    // Verify splitter concurrency was respected
    expect(trackedSplitter.maxInFlight).toBe(concurrencyLimit);
  });

  it.concurrent('respects concurrency in streams with slow input', async () => {
    // Create a slow input generator
    async function* slowInputGenerator(): AsyncGenerator<number> {
      for (let i = 1; i <= 20; i++) {
        if (i % 5 == 0) await delay(20); // Delay between yielding each value
        yield i;
      }
    }

    // Create processors for two streams, each with tracked concurrency
    const streamAConcurrency = 3;
    const streamBConcurrency = 2;
    const totalConcurrency = 5;

    // Create trackers for both streams
    const trackedProcessorA = trackConcurrency(async (x: number) => {
      console.log('A', x);
      await delay(20); // Stream A is slower
      if (x == 19) {
        debugger;
      }
      return x * 2;
    });

    const trackedProcessorB = trackConcurrency(async (x: number) => {
      console.log('B', x);
      await delay(20); // Stream B is faster
      return x * -2;
    });

    // Create stream processors with the tracked functions
    const streamA = map(trackedProcessorA, streamAConcurrency);
    const streamB = map(trackedProcessorB, streamBConcurrency);

    // Route odd numbers to stream A, even numbers to stream B
    const splitter = (x: number) =>
      x % 2 === 1 ? ([x, undefined] as const) : ([undefined, x] as const);

    // Create the pipeline with configured concurrency
    const result = pipe(
      slowInputGenerator(),
      dispatch(splitter, streamA, streamB, undefined, undefined, totalConcurrency)
    );

    // Process all data
    const output = await accumulate(result);

    // Verify correct routing and processing
    const expectedOutput = Array.from({ length: 20 }, (_, i) => i + 1);
    expect(output).toEqual(expectedOutput);

    // Verify stream concurrency was respected
    // Stream A should have max concurrency capped by either totalConcurrency or streamAConcurrency
    expect(trackedProcessorA.maxInFlight).toBe(streamAConcurrency); // 10 = number of odd items

    // Stream B should have max concurrency capped by either totalConcurrency or streamBConcurrency
    expect(trackedProcessorB.maxInFlight).toBe(streamBConcurrency); // 10 = number of even items

    // Both streams together shouldn't exceed total concurrency
    expect(trackedProcessorA.maxInFlight + trackedProcessorB.maxInFlight).toBeLessThanOrEqual(
      totalConcurrency
    );
  });
});
