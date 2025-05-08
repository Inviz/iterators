/**
 * Functions for creating chunks of elements from an iterable
 */

import { pubsub } from './lib/pubsub';
import type { AnyIterable } from './types';

/**
 * Internal implementation of async chunk
 *
 * @param input Source iterable to chunk
 * @param size Size of each chunk
 */
async function* _chunk<T>(input: AnyIterable<T>, size: number): AsyncGenerator<T[]> {
  if (size <= 0) return;

  let buffer: T[] = [];
  for await (const value of input) {
    buffer.push(value);

    if (buffer.length >= size) {
      yield buffer;
      buffer = [];
    }
  }

  // Yield remaining items if any
  if (buffer.length > 0) {
    yield buffer;
  }
}

/**
 * Internal implementation of concurrent chunk
 *
 * @param input Source iterable to chunk
 * @param size Size of each chunk
 * @param concurrency Maximum number of concurrent operations
 */
function _chunkConcurrently<T>(
  input: AnyIterable<T>,
  size: number,
  concurrency: number
): AsyncGenerator<T[]> {
  const { publish, producing, wait, output, onReadComplete } = pubsub<T[]>(concurrency);

  return output({
    onStart: async () => {
      let buffer: T[] = [];
      // Process the input stream without blocking the main loop
      try {
        for await (const item of input) {
          buffer.push(item);

          if (buffer.length >= size) {
            if (producing.size >= concurrency) {
              await wait();
            }
            const chunk = buffer;
            buffer = [];
            publish(chunk);
          }
        }
      } finally {
        // Publish remaining items if any
        if (buffer.length > 0) {
          if (producing.size >= concurrency) {
            await wait();
          }
          await publish(buffer);
          await new Promise(setImmediate);
        }
        onReadComplete();
      }
    },
  });
}

/**
 * Creates a function that chunks elements of an iterable into arrays of specified size
 * If concurrency is provided, processes the iterable concurrently
 */
export function chunk<T>(
  input: AnyIterable<T>,
  size: number,
  concurrency?: number
): AsyncGenerator<T[]>;
export function chunk<T>(
  size: number,
  concurrency?: number
): (input: AnyIterable<T>) => AsyncGenerator<T[]>;

export function chunk<T>(input: AnyIterable<T> | number, size?: number, concurrency?: number) {
  if (typeof input === 'number') {
    return (_input: AnyIterable<T>) => chunk(_input, input, size);
  } else if (concurrency && concurrency > 1) {
    return _chunkConcurrently(input, size as number, concurrency || 1);
  } else {
    return _chunk(input, size as number);
  }
}
