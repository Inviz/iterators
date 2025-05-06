import { describe, expect, it, vi } from 'vitest';
import { writer } from '../lib/writer';
import { map } from '../map';
import { pipe } from '../pipe';

describe.concurrent('writer', () => {
  it('should push values through the pipe and process them', async () => {
    // Create a simple pipe that multiplies numbers by 2
    const pipe = writer(map((x: number) => x * 2));

    // Push values through the pipe
    expect(await pipe.write(1)).toBe(2);
    expect(await pipe.write(2)).toBe(4);
    expect(await pipe.write(3)).toBe(6);
  });

  it('should handle async transformations', async () => {
    // Create a pipe with async transformation
    const pipe = writer(
      map(async (x: number) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return x * 3;
      })
    );

    // Push values through the pipe
    expect(await pipe!.write(1)).toBe(3);
    expect(await pipe!.write(2)).toBe(6);
  });

  it('should respect the concurrency parameter', async () => {
    // Create a tracking array to verify execution order
    const processingOrder: string[] = [];

    // Create a pipe with concurrency limit of 2
    const pipe = writer(
      map(
        async (x: number) => {
          processingOrder.push(`start-${x}`);
          // Items will complete in reverse order (3 first, then 2, then 1)
          await new Promise(resolve => setTimeout(resolve, x * 10));
          processingOrder.push(`end-${x}`);
          return x;
        },
        2 // Concurrency limit
      ),
      2
    );

    const values = await Promise.all([pipe!.write(5), pipe!.write(3), pipe!.write(1)]);

    // Verify processing order
    // First two should start immediately due to concurrency=2
    console.log(processingOrder);
    expect(processingOrder.indexOf('start-5')).toBeLessThan(processingOrder.indexOf('start-3'));
    expect(processingOrder.indexOf('start-3')).toBeLessThan(processingOrder.indexOf('start-1'));

    // The fastest one should finish first
    expect(processingOrder.indexOf('end-1')).toBeGreaterThan(processingOrder.indexOf('end-3'));
    expect(processingOrder.indexOf('end-5')).toBeGreaterThan(processingOrder.indexOf('end-1'));
  });

  it('should create a proper generator from the pipe', async () => {
    // Create a pipe
    const pipe = writer(map((x: string) => x.toUpperCase()));

    // Generator should produce an iterable
    await pipe.publish('a');
    await pipe.publish('b');
    await pipe.publish('c');
    await pipe.end();

    const results: string[] = [];
    console.log('pipe', pipe);
    for await (const result of pipe) {
      console.log('result', result);
      results.push(result);
    }
    expect(results).toEqual(['A', 'B', 'C']);
  });

  it('should advance the iterator when values are pushed', async () => {
    // Create a spy to track iterator.next() calls
    const mockIterator = {
      next: vi.fn().mockResolvedValue({ value: undefined, done: false }),
    };

    // Mock the callback to return our spy
    const mockCallback = vi.fn().mockReturnValue(mockIterator);

    // Create the writer with our mock
    const pipe = writer(mockCallback);

    // Push a value
    await pipe!.write('test');

    // Verify the iterator was advanced
    expect(mockIterator.next).toHaveBeenCalledTimes(1);
  });

  it.concurrent('should handle complex transformation pipelines with pipe', async () => {
    // Processing functions
    const addOne = (x: number) => x + 1;
    const multiplyByTwo = (x: number) => x * 2;
    const formatResult = (x: number) => `Result: ${x}`;

    // Create test data
    const items = [1, 2, 3, 4, 5];

    // Create a transformation pipeline using pipe and map
    const pipeline = pipe(map(addOne), map(multiplyByTwo), map(formatResult));

    // Process items through the pipeline
    const results: string[] = [];
    for await (const result of pipeline(items)) {
      results.push(result);
    }

    // Verify results match expected transformations
    expect(results).toEqual([
      'Result: 4', // (1+1)*2
      'Result: 6', // (2+1)*2
      'Result: 8', // (3+1)*2
      'Result: 10', // (4+1)*2
      'Result: 12', // (5+1)*2
    ]);
  });
});
