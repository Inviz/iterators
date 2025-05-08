/**
 * Functions for taking a limited number of elements from an iterable
 */

import type { AnyIterable } from './types';

/**
 * Internal implementation of async take
 *
 * @param input Source iterable to take from
 * @param count Number of elements to take
 */
async function* _take<T>(input: AnyIterable<T>, count: number): AsyncGenerator<T> {
  if (count <= 0) return;

  let taken = 0;
  debugger;
  for await (const value of input) {
    console.log('take', taken, value);
    yield value;
    taken++;
    console.log('take', taken);
    if (taken >= count) break;
  }
  console.log('take done', taken);
}

/**
 * Creates a function that takes a limited number of elements from an iterable
 */
export function take<T>(input: AnyIterable<T>, count: number): AsyncGenerator<T>;
export function take<T>(count: number): (input: AnyIterable<T>) => AsyncGenerator<T>;
export function take<T>(input: AnyIterable<T> | number, count?: any) {
  if (typeof input === 'number') {
    return (_input: AnyIterable<T>) => take(_input, input);
  } else {
    return _take(input, count);
  }
}
