/**
 * Functions for creating chunks of elements from an iterable
 */

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
 * Creates a function that chunks elements of an iterable into arrays of specified size
 * @param input The iterable to chunk
 * @param size The size of each chunk
 */
export function chunk<T>(input: AnyIterable<T>, size: number): AsyncGenerator<T[]>;
export function chunk<T>(size: number): (input: AnyIterable<T>) => AsyncGenerator<T[]>;
export function chunk<T>(input: AnyIterable<T> | number, size?: any) {
  if (typeof input === 'number') {
    return (_input: AnyIterable<T>) => chunk(_input, input);
  } else {
    return _chunk(input, size);
  }
}
